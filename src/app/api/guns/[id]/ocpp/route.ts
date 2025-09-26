import { NextResponse } from 'next/server';
// 使用統一的 database service
import DatabaseUtils from '../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

// 使用新的 OCPP API 端點
const OCPP_BASE_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
const OCPP_API_KEY = process.env.OCPP_API_KEY || 'cp_api_key16888';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[api/guns/[id]/ocpp] Processing OCPP command request');

    // extract dynamic id from request URL instead of relying on params
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    // expect path like /api/guns/<id>/ocpp
    const ocppIndex = segments.lastIndexOf('ocpp');
    const gunId = ocppIndex > 0 ? segments[ocppIndex - 1] : undefined;
    if (!gunId) return NextResponse.json({ error: 'Missing charger id' }, { status: 400 });

    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const numericId = Number(gunId);
    const gun = await databaseService.getGunById(isNaN(numericId) ? gunId : numericId);
    
    if (!gun) {
      console.log('[api/guns/[id]/ocpp] Gun not found for id:', gunId);
      return NextResponse.json({ error: 'Gun not found' }, { status: 404 });
    }

    const cmd = body.cmd ?? 'cmd_start_charging';

    // 根據命令類型決定使用哪個新的 API 端點
    let apiEndpoint: string;
    let requestBody: Record<string, unknown>;
    
    switch (cmd) {
      case 'cmd_start_charging':
        // 使用新的遠程啟動 API
        apiEndpoint = `${OCPP_BASE_URL}/api/v1/chargepoints/${gun.cpsn}/remotestart`;
        requestBody = {
          connectorId: body.connectorId || 1, // 支援自定義連接器ID
          idTag: body.user_id_tag , // 使用 user_id_tag 作為 RFID 標籤
          userUuid: body.user_uuid // 添加用戶 UUID
        };
        break;
      case 'cmd_stop_charging':
        // 使用新的遠程停止 API
        apiEndpoint = `${OCPP_BASE_URL}/api/v1/chargepoints/${gun.cpsn}/remotestop`;
        requestBody = {
          connectorId: body.connectorId || 1, // 加入連接器ID參數
          transactionId: body.transactionId || gun.transactionid || 1, // 使用正確的欄位名稱
          userUuid: body.user_uuid // 添加用戶 UUID
        };
        break;
      default:
        console.log('[api/guns/[id]/ocpp] Unsupported command:', cmd);
        return NextResponse.json({ error: 'Unsupported command', supportedCommands: ['cmd_start_charging', 'cmd_stop_charging'] }, { status: 400 });
    }

    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (OCPP_API_KEY) headers['Authorization'] = `Bearer ${OCPP_API_KEY}`;

    const upstream = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    }).catch(() => { throw new Error('Upstream request failed') });

    const text = await upstream.text().catch(() => null);

    return NextResponse.json({ success: upstream.ok, status: upstream.status, upstreamBody: text });
  } catch (err: unknown) {
    console.error('[api/guns/[id]/ocpp] POST error:', err instanceof Error ? err.message : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
