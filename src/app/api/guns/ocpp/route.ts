import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

// 使用新的 OCPP API 端點
const OCPP_BASE_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
const OCPP_API_KEY = process.env.OCPP_API_KEY || 'cp_api_key16888';

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
    
    // 根據命令類型決定使用哪個 API 端點
    let apiEndpoint: string;
    let requestBody: Record<string, unknown>;
    let httpMethod: string;
    
    switch (cmd) {
      case 'cmd_start_charging':
        // 使用新的遠程啟動 API
        apiEndpoint = `${OCPP_BASE_URL}/api/v1/chargepoints/${gun.cpsn}/remotestart`;
        httpMethod = 'POST';
        requestBody = {
            //   注意事項：
        //   目前使用webapp端是 uuid來判別使用者，之前使用rfid來判斷是因為充電樁會有一個逼卡的動作，現在應該是不需要了
        //   idTag: body.user_id_tag,
        //   userUuid: body.user_uuid
          connectorId: body.connectorId || 1,
          idTag: body.user_uuid,
          userUuid: body.user_uuid
        
        };
        console.log(`🚀 [API /api/guns/ocpp] Starting charge for ${gun.cpsn}`);
        break;
        
      case 'cmd_stop_charging':
        // 使用新的遠程停止 API
        apiEndpoint = `${OCPP_BASE_URL}/api/v1/chargepoints/${gun.cpsn}/remotestop`;
        httpMethod = 'POST';
        requestBody = {
          connectorId: body.connectorId || 1,
          transactionId: body.transactionId || gun.transactionid || 1,
          userUuid: body.user_uuid
        };
        console.log(`🛑 [API /api/guns/ocpp] Stopping charge for ${gun.cpsn}`);
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
    
    // 發送請求到 OCPP 服務
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json' 
    };
    
    if (OCPP_API_KEY) {
      headers['Authorization'] = `Bearer ${OCPP_API_KEY}`;
    }
    
    console.log(`📡 [API /api/guns/ocpp] Sending ${httpMethod} request to: ${apiEndpoint}`);
    
    const upstream = await fetch(apiEndpoint, {
      method: httpMethod,
      headers,
      body: JSON.stringify(requestBody),
    }).catch((err) => {
      console.error('❌ [API /api/guns/ocpp] Upstream request failed:', err);
      throw new Error('Upstream request failed');
    });
    
    const text = await upstream.text().catch(() => null);
    
    if (upstream.ok) {
      console.log(`✅ [API /api/guns/ocpp] Command executed successfully`);
    } else {
      console.log(`❌ [API /api/guns/ocpp] Command failed with status: ${upstream.status}`);
    }
    
    return NextResponse.json({ 
      success: upstream.ok, 
      status: upstream.status, 
      upstreamBody: text,
      gun: {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn
      }
    });
    
  } catch (err: unknown) {
    console.error('❌ [API /api/guns/ocpp] POST error:', err instanceof Error ? err.message : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: errorMessage 
      }, 
      { status: 500 }
    );
  }
}
