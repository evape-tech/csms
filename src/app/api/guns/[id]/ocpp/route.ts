import { NextResponse } from 'next/server';
// 使用統一的 database service
const DatabaseUtils = require('../../../../../lib/database/utils');
const { databaseService } = require('../../../../../lib/database/service');

export const dynamic = 'force-dynamic';

// external OCPP service URL and API key
const OCPP_NOTIFY_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089/ocpp/api/spacepark_cp_api';
const OCPP_API_KEY = process.env.OCPP_API_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[api/guns/[id]/ocpp] incoming request url=', req.url);
    try { console.log('[api/guns/[id]/ocpp] incoming body=', JSON.stringify(body)); } catch(e) { console.log('[api/guns/[id]/ocpp] incoming body (raw)=', body); }

    // extract dynamic id from request URL instead of relying on params
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    // expect path like /api/guns/<id>/ocpp
    const ocppIndex = segments.lastIndexOf('ocpp');
    const gunId = ocppIndex > 0 ? segments[ocppIndex - 1] : undefined;
    console.log('[api/guns/[id]/ocpp] resolved gunId=', gunId);
    if (!gunId) return NextResponse.json({ error: 'Missing charger id' }, { status: 400 });

    // try to find cp_id from body or DB
    let cpId = body.cp_id;
    console.log('[api/guns/[id]/ocpp] cpId from body=', cpId);
    if (!cpId) {
      // 確保資料庫已初始化
      await DatabaseUtils.initialize(process.env.DB_PROVIDER);
      
      const numericId = Number(gunId);
      const gun = await databaseService.getGunById(isNaN(numericId) ? gunId : numericId);
      console.log('[api/guns/[id]/ocpp] gunRow from DB=', gun ? { cpid: gun.cpid } : null);
      if (gun) cpId = gun.cpid;
    }

    const apikey = OCPP_API_KEY || 'cp_api_key16888';

    // build forward payload (ensure shape: { apikey, cp_id, cmd, [payload] })
    const cmd = body.cmd ?? 'cmd_start_charging';
    const forwardBody: any = { apikey, cmd };
    if (cpId) {
      forwardBody.cp_id = cpId;
    } else if (body.cp_id) {
      forwardBody.cp_id = body.cp_id;
    }
    // optional payload passthrough
    if (body.payload !== undefined) forwardBody.payload = body.payload;

    console.log('[api/guns/[id]/ocpp] forwardBody=', JSON.stringify(forwardBody));

    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (OCPP_API_KEY) headers['Authorization'] = `Bearer ${OCPP_API_KEY}`;
    console.log('[api/guns/[id]/ocpp] forward headers=', headers);

    const upstream = await fetch(OCPP_NOTIFY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(forwardBody),
    }).catch(e => { throw e });

    const text = await upstream.text().catch(() => null);
    console.log('[api/guns/[id]/ocpp] upstream status=', upstream?.status, 'ok=', upstream?.ok);
    try { console.log('[api/guns/[id]/ocpp] upstream body=', text); } catch(e) { console.log('[api/guns/[id]/ocpp] upstream body (raw)=', text); }

    return NextResponse.json({ success: upstream.ok, status: upstream.status, upstreamBody: text });
  } catch (err: any) {
    console.error('[api/guns/[id]/ocpp] POST error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}
