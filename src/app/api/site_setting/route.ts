import { NextResponse } from 'next/server';
// 使用統一的 database service
const DatabaseUtils = require('../../../lib/database/utils');
const { databaseService } = require('../../../lib/database/service');

// notify configuration for ocpp server (used to inform ocpp service after DB changes)
const OCPP_NOTIFY_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089/ocpp/api/spacepark_cp_api';
const OCPP_API_KEY = process.env.OCPP_API_KEY || '';

async function notifyOcpp(payload: any) {
  // notifyOcpp 註解與追蹤日誌：
  // 1) 構造出 ocppController 預期的 body（broadcastBody）
  // 2) 先嘗試一次對 OCPP_NOTIFY_URL 的「廣播呼叫」(若伺服器支援廣播)
  // 3) 若廣播失敗或回傳非 2xx，則 fallback 去 DB 撈所有 cpid，逐一帶 cp_id 發送
  // 4) 所有步驟均有詳細 console.log 以便追蹤

  console.log('[notifyOcpp] incoming payload:', JSON.stringify(payload));

  const defaultApiKey = OCPP_API_KEY || 'cp_api_key16888';

  // 構造 broadcastBody，使其符合 ocppController 的期待格式
  let broadcastBody: any;
  if (payload?.action === 'site_setting_changed' && payload.data) {
    // site setting 被改變 — 使用 siteSetting 欄位包裹
    broadcastBody = {
      apikey: defaultApiKey,
      cmd: 'cmd_set_charging_profile',
      payload: { siteSetting: payload.data },
    };
  } else if (payload && payload.cmd) {
    // payload 已經是 ocppController 預期的格式
    broadcastBody = { apikey: defaultApiKey, ...payload };
  } else {
    // 通用 fallback 包裝
    broadcastBody = {
      apikey: defaultApiKey,
      cmd: 'cmd_set_charging_profile',
      payload: { siteSetting: payload.data ?? payload },
    };
  }

  console.log('[notifyOcpp] constructed broadcastBody:', JSON.stringify(broadcastBody));

  // broadcast disabled: proceed directly to per-CP loop
  console.log('[notifyOcpp] broadcast attempt disabled; proceeding to per-CP sends');

  // 逐台發送，並 log 每台結果
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const guns = await databaseService.getGuns({});
    const cpRows = guns.map((gun: any) => ({ cpid: gun.cpid }));
    
    console.log('[notifyOcpp] fallback: found cp rows count =', cpRows.length);
    if (!cpRows || cpRows.length === 0) {
      console.log('[notifyOcpp] fallback: no cpids found in database');
      return;
    }

    // Filter out rows with null/empty cpid and map only confirmed string cpids
    const perCpPromises = cpRows
      .filter((r: any): r is { cpid: string } => typeof r.cpid === 'string' && r.cpid.length > 0)
      .map((r: { cpid: string }) => {
        const bodyPerCp = { ...broadcastBody, cp_id: r.cpid };
        // log each outgoing body minimally (avoid huge logs)
        console.log('[notifyOcpp] sending to cp:', r.cpid, 'cmd:', bodyPerCp.cmd);
        return fetch(OCPP_NOTIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPerCp),
        })
          .then(res => ({ cpid: r.cpid, ok: res.ok, status: res.status }))
          .catch(err => ({ cpid: r.cpid, ok: false, error: String(err) }));
      });

    const results = await Promise.allSettled(perCpPromises);

    // 簡短統計與每台結果 log
    const summary = { success: 0, fail: 0, details: [] as any[] };
    results.forEach((r: any) => {
      if (r.status === 'fulfilled') {
        summary.details.push(r.value);
        if (r.value.ok) summary.success += 1;
        else summary.fail += 1;
        console.log('[notifyOcpp] per-cp result:', r.value);
      } else {
        summary.fail += 1;
        console.error('[notifyOcpp] per-cp promise rejected', r.reason);
      }
    });

    console.log('[notifyOcpp] per-cp summary:', JSON.stringify({ total: cpRows.length, success: summary.success, fail: summary.fail }));
  } catch (err) {
    console.error('[notifyOcpp] fallback error:', err);
  }
}

export async function GET(req: Request) {
  try {
    console.log(`🔍 [API /api/site_setting] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // return all site settings; adjust to findFirst or where clause if needed
    const rows = await databaseService.getSiteSettings();
    console.log(`✅ [API /api/site_setting] Found ${rows.length} site_settings records via databaseService`);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('/api/site_setting GET error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    console.log(`🔍 [API /api/site_setting PATCH] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    // we assume site_settings is single-row; update the first row
    const existingSettings = await databaseService.getSiteSettings();
    const existing = existingSettings.length > 0 ? existingSettings[0] : null;
    
    if (!existing) {
      return NextResponse.json({ error: 'No site_settings row found' }, { status: 404 });
    }

    const data: any = {};
    if (Object.prototype.hasOwnProperty.call(body, 'ems_mode')) data.ems_mode = body.ems_mode;
    if (Object.prototype.hasOwnProperty.call(body, 'max_power_kw')) data.max_power_kw = body.max_power_kw;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await databaseService.updateSiteSettings(existing.id, data);
    console.log(`✅ [API /api/site_setting PATCH] Updated site_setting via databaseService:`, updated.id);

    // non-blocking notify to ocpp server so gateway can inform chargers
    notifyOcpp({
      action: 'site_setting_changed',
      data: {
        id: updated.id,
        ems_mode: updated.ems_mode,
        max_power_kw: updated.max_power_kw,
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('/api/site_setting PATCH error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}
