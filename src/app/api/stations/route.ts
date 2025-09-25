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

    const response = await fetch(`${OCPP_BASE_URL}/ocpp/api/v1/trigger_profile_update`, {
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
    console.log(`🔍 [API /api/stations] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 獲取所有場域及其相關的電表和充電槍資訊
    const stations = await databaseService.getStations();
    console.log(`✅ [API /api/stations] Found ${stations.length} stations with meters and guns via databaseService`);
    
    const response = NextResponse.json(stations);
    
    // 設置快取控制標頭，確保不會被快取
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (err: unknown) {
    console.error('/api/stations GET error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    console.log(`🔍 [API /api/stations PATCH] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    
    // 檢查是否提供了station_id，如果沒有則使用第一個場域
    const stationId = body.station_id || body.stationId;
    let targetStation;
    
    if (stationId) {
      targetStation = await databaseService.getStationById(stationId);
    } else {
      // 如果沒有指定station_id，使用第一個場域
      const allStations = await databaseService.getStations();
      targetStation = allStations.length > 0 ? allStations[0] : null;
    }
    
    if (!targetStation) {
      return NextResponse.json({ error: 'No station found' }, { status: 404 });
    }

    // 分離場域更新和電表更新
    const stationData: Record<string, unknown> = {};
    const meterData: Record<string, unknown> = {};
    
    // 場域基本資訊
    if (Object.prototype.hasOwnProperty.call(body, 'name')) stationData.name = body.name;
    if (Object.prototype.hasOwnProperty.call(body, 'address')) stationData.address = body.address;
    if (Object.prototype.hasOwnProperty.call(body, 'floor')) stationData.floor = body.floor;
    if (Object.prototype.hasOwnProperty.call(body, 'operator_id')) stationData.operator_id = body.operator_id;
    
    // EMS相關設定（現在在meters表中）
    if (Object.prototype.hasOwnProperty.call(body, 'ems_mode')) meterData.ems_mode = body.ems_mode;
    if (Object.prototype.hasOwnProperty.call(body, 'max_power_kw')) meterData.max_power_kw = body.max_power_kw;
    if (Object.prototype.hasOwnProperty.call(body, 'billing_mode')) meterData.billing_mode = body.billing_mode;
    if (Object.prototype.hasOwnProperty.call(body, 'owner_id')) meterData.owner_id = body.owner_id;

    if (Object.keys(stationData).length === 0 && Object.keys(meterData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    let updatedStation = targetStation;
    let updatedMeter = null;

    // 更新場域資訊
    if (Object.keys(stationData).length > 0) {
      updatedStation = await databaseService.updateStation(targetStation.id, stationData);
      console.log(`✅ [API /api/stations PATCH] Updated station ${targetStation.id} via databaseService`);
    }

    // 更新電表資訊（如果場域有電表）
    if (Object.keys(meterData).length > 0 && targetStation.meters && targetStation.meters.length > 0) {
      // 更新第一個電表（或可以根據meter_id來指定）
      const meterId = body.meter_id || body.meterId || targetStation.meters[0].id;
      updatedMeter = await databaseService.updateMeter(meterId, meterData);
      console.log(`✅ [API /api/stations PATCH] Updated meter ${meterId} via databaseService`);
    }

    // 準備回應數據
    const responseData = {
      station: updatedStation,
      meter: updatedMeter,
      message: 'Station settings updated successfully'
    };

    // 通知OCPP服務器
    notifyOcpp({
      action: 'station_settings_changed',
      data: {
        station_id: updatedStation.id,
        station_code: updatedStation.station_code,
        ems_mode: updatedMeter?.ems_mode || targetStation.meters?.[0]?.ems_mode,
        max_power_kw: updatedMeter?.max_power_kw || targetStation.meters?.[0]?.max_power_kw,
      }
    });

    // 清除快取
    revalidatePath('/api/stations');

    return NextResponse.json(responseData);
  } catch (err: unknown) {
    console.error('/api/stations PATCH error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
