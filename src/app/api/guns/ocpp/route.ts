import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';
import { remoteStart, remoteStop } from '../../../../lib/ocppCoreClient';

export const dynamic = 'force-dynamic';

/**
 * OCPP 命令 API (無需 [id] 參數)
 * 
 * 用途：發送 OCPP 命令到充電樁，支援多種識別方式
 * 
 * 支援的識別方式（優先順序：body > query）：
 * - id: 充電樁資料庫 ID
 * - cpid: 充電樁 ID
 * - cpsn: 充電樁序號
 * 
 * 支援的命令：
 * - cmd_start_charging: 遠程啟動充電
 * - cmd_stop_charging: 遠程停止充電
 * 
 * @route POST /api/guns/ocpp
 * @route POST /api/guns/ocpp?cpsn=xxx
 * 
 * @body {
 *   cmd: "cmd_start_charging" | "cmd_stop_charging",
 *   id?: string | number,
 *   cpid?: string,
 *   cpsn?: string,
 *   connectorId?: number,
 *   user_id_tag?: string,
 *   user_uuid?: string,
 *   transactionId?: number
 * }
 * 
 * @returns { success: boolean, status: number, upstreamBody: string }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [API /api/guns/ocpp] Processing OCPP command request');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    let cpid = searchParams.get('cpid');
    let cpsn = searchParams.get('cpsn');
    let id = searchParams.get('id');
    
    // 解析 request body
    let body: any = {};
    try {
      body = await request.json();
      console.log('🔍 [API /api/guns/ocpp] Request body:', body);
    } catch (err) {
      console.error('❌ [API /api/guns/ocpp] Failed to parse request body:', err);
      console.log('🔍 [API /api/guns/ocpp] Request headers:', Object.fromEntries(request.headers));
    }
    
    // Body 參數優先於 Query 參數
    cpid = body.cpid || cpid;
    cpsn = body.cpsn || cpsn;
    id = body.id || id;
    
    const cmd = body.cmd ?? 'cmd_start_charging';
    
    // 驗證是否有提供充電樁識別資訊
    if (!id && !cpid && !cpsn) {
      console.log('❌ [API /api/guns/ocpp] Missing charger identifier');
      return NextResponse.json(
        { 
          error: 'Missing charger identifier', 
          message: '請提供 id、cpid 或 cpsn 其中之一' 
        }, 
        { status: 400 }
      );
    }
    
    // 查詢充電樁
    let gun: any = null;
    
    if (id) {
      const numericId = Number(id);
      gun = await databaseService.getGunById(isNaN(numericId) ? id : numericId);
      console.log(`🔍 [API /api/guns/ocpp] Looking up gun by id: ${id}`);
    } else {
      // 使用 cpid 或 cpsn 查詢
      const filter: Record<string, any> = {};
      if (cpid) filter.cpid = cpid;
      if (cpsn) filter.cpsn = cpsn;
      
      console.log(`🔍 [API /api/guns/ocpp] Looking up gun by filter:`, filter);
      const guns = await databaseService.getGuns(filter);
      
      if (guns && guns.length > 0) {
        gun = guns[0];
      }
    }
    
    if (!gun) {
      console.log('❌ [API /api/guns/ocpp] Gun not found');
      return NextResponse.json(
        { error: 'Gun not found', message: '找不到指定的充電樁' }, 
        { status: 404 }
      );
    }
    
    console.log(`✅ [API /api/guns/ocpp] Found gun: ${gun.cpsn}`);
    
    const connectorId = Number(body.connectorId) || 1;
    const idTag = body.user_uuid || body.user_id_tag || body.idTag || gun.cpsn;
    const transactionId = body.transactionId || gun.transactionid || gun.transactionId;

    // 根據命令類型決定呼叫 ocpp-core 的 API
    let upstreamResult: unknown;
    let commandExecuted: 'remote-start' | 'remote-stop';
    
    switch (cmd) {
      case 'cmd_start_charging':
        console.log(`🚀 [API /api/guns/ocpp] Starting charge for ${gun.cpsn}`);
        upstreamResult = await remoteStart({
          cpsn: gun.cpsn,
          connectorId,
          idTag,
          chargingProfile: body.chargingProfile,
        });
        commandExecuted = 'remote-start';
        break;
        
      case 'cmd_stop_charging':
        if (!transactionId && transactionId !== 0) {
          return NextResponse.json(
            {
              error: 'Missing transactionId',
              message: '請提供 transactionId 用於停止充電',
            },
            { status: 400 },
          );
        }

        console.log(`🛑 [API /api/guns/ocpp] Stopping charge for ${gun.cpsn}`);
        upstreamResult = await remoteStop({
          cpsn: gun.cpsn,
          transactionId: Number(transactionId),
        });
        commandExecuted = 'remote-stop';
        break;
        
      default:
        console.log('❌ [API /api/guns/ocpp] Unsupported command:', cmd);
        return NextResponse.json(
          { 
            error: 'Unsupported command', 
            supportedCommands: ['cmd_start_charging', 'cmd_stop_charging'],
            receivedCommand: cmd
          }, 
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      command: commandExecuted,
      result: upstreamResult,
      gun: {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
      },
    });
    
  } catch (err: unknown) {
    console.error('❌ [API /api/guns/ocpp] POST error:', err instanceof Error ? err.message : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.status && Number.isInteger((err as any)?.status)
      ? (err as any).status
      : 500;
    return NextResponse.json(
      {
        error: 'Failed to execute OCPP command',
        message: errorMessage,
        details: (err as any)?.data,
      },
      { status: status === 0 ? 500 : status },
    );
  }
}
