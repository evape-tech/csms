import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
// 使用統一的 database service
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseService } from '../../../lib/database/service.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// notify configuration for ocpp server (used to inform ocpp service after DB changes)
const OCPP_BASE_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
const OCPP_API_KEY = process.env.OCPP_API_KEY || '';

async function notifyOcpp(payload: Record<string, unknown>) {
  console.log('[notifyOcpp] incoming payload:', JSON.stringify(payload));

  try {
    // 使用新的API端點触发全站功率重新分配
    const triggerPayload = {
      source: (payload?.action as string) || 'site_setting_changed',
      timestamp: new Date().toISOString(),
      userAgent: 'NextJS-API-Route',
      clientIP: 'server'
    };

    console.log('[notifyOcpp] triggering profile update with payload:', JSON.stringify(triggerPayload));

    const response = await fetch(`${OCPP_BASE_URL}/ocpp/api/trigger_profile_update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triggerPayload),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('[notifyOcpp] ✅ Profile update triggered successfully:', result);
      console.log(`[notifyOcpp] 📊 Summary: ${result.onlineStations || 0} online stations, ${result.scheduledUpdates || 0} updates scheduled`);
    } else {
      console.error('[notifyOcpp] ❌ Profile update failed:', result);
    }

  } catch (err) {
    console.error('[notifyOcpp] error:', err);
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
    
    const response = NextResponse.json(rows);
    
    // 設置快取控制標頭，確保不會被快取
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (err: unknown) {
    console.error('/api/site_setting GET error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
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

    const data: Record<string, unknown> = {};
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

    // 清除快取
    revalidatePath('/api/site_setting');

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error('/api/site_setting PATCH error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
