"use server";

import { revalidatePath } from 'next/cache';

// 直接使用資料庫服務，避免繞過 API 路由
import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';

// OCPP 通知設定
const OCPP_BASE_URL = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
const OCPP_API_KEY = process.env.OCPP_API_KEY || '';

async function notifyOcpp(payload) {
  console.log('[notifyOcpp] incoming payload:', JSON.stringify(payload));

  try {
    // 確保資料庫已初始化，獲取該電表下的充電桩列表
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const meterId = payload?.data?.meter_id;
    const stationId = payload?.data?.station_id;
    
    if (!meterId) {
      console.warn('[notifyOcpp] ⚠️ 沒有提供 meter_id，將觸發全站重分配');
    }

    // 獲取該電表下關聯的充電桩列表
    let affectedCpids = [];
    if (meterId) {
      try {
        const gunsForMeter = await databaseService.getGuns({ meter_id: meterId });
        affectedCpids = gunsForMeter.map(gun => gun.cpid).filter(cpid => cpid);
        console.log(`[notifyOcpp] 🔍 電表 ${meterId} 下有 ${affectedCpids.length} 個充電桩: [${affectedCpids.join(', ')}]`);
      } catch (err) {
        console.error(`[notifyOcpp] ❌ 獲取電表 ${meterId} 下充電桩失敗:`, err.message);
      }
    }

    // 構建更精確的觸發負載
    const triggerPayload = {
      source: payload?.action || 'meter_setting_changed',
      timestamp: new Date().toISOString(),
      userAgent: 'NextJS-Server-Action',
      clientIP: 'server',
      // 新增電表和充電桩資訊
      meter_id: meterId,
      station_id: stationId,
      affected_cpids: affectedCpids, // 明確指定要更新的充電桩
      updated_settings: {
        ems_mode: payload?.data?.ems_mode,
        max_power_kw: payload?.data?.max_power_kw
      }
    };

    console.log('[notifyOcpp] triggering targeted profile update with payload:', JSON.stringify(triggerPayload));

    const response = await fetch(`${OCPP_BASE_URL}/ocpp/api/v1/trigger_profile_update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triggerPayload),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('[notifyOcpp] ✅ Profile update triggered successfully:', result);
      console.log(`[notifyOcpp] 📊 Summary: ${result.onlineStations || 0} online stations, ${result.scheduledUpdates || 0} updates scheduled`);
      console.log(`[notifyOcpp] 🎯 Targeted: 電表 ${meterId} 影響 ${affectedCpids.length} 個充電桩`);
    } else {
      console.error('[notifyOcpp] ❌ Profile update failed:', result);
    }

  } catch (err) {
    console.error('[notifyOcpp] error:', err);
  }
}

export async function updateBalanceMode(formData) {
  try {
    const emsMode = formData.get('ems_mode');
    const meterId = formData.get('meter_id'); // 可選的電表ID
    
    console.log(`🔍 [updateBalanceMode] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    console.log(`🔍 [updateBalanceMode] Updating ems_mode to: "${emsMode}"`);
    console.log(`🔍 [updateBalanceMode] Target meter_id: ${meterId || '全部電表'}`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 取得所有站點和電表
    const allStations = await databaseService.getStations();
    
    if (!allStations || allStations.length === 0) {
      throw new Error('No stations found');
    }

    let updatedMeters = [];
    let totalUpdated = 0;

    // 如果指定了 meter_id，只更新該電表
    if (meterId) {
      console.log(`🎯 [updateBalanceMode] 更新指定電表 ${meterId}`);
      
      // 找到指定的電表
      let targetMeter = null;
      let targetStation = null;
      
      for (const station of allStations) {
        if (station.meters && Array.isArray(station.meters)) {
          const meter = station.meters.find(m => m.id === parseInt(meterId));
          if (meter) {
            targetMeter = meter;
            targetStation = station;
            break;
          }
        }
      }
      
      if (!targetMeter) {
        throw new Error(`Meter with ID ${meterId} not found`);
      }
      
      console.log(`🔍 [updateBalanceMode] Found target meter: ${targetMeter.id} in station ${targetStation.id}`);
      
      // 更新指定電表
      const updatedMeter = await databaseService.updateMeter(targetMeter.id, { ems_mode: emsMode });
      console.log(`✅ [updateBalanceMode] Updated meter ${targetMeter.id} with ems_mode: "${emsMode}"`);
      
      const serializedMeter = {
        station_id: targetStation.id,
        station_code: targetStation.station_code,
        meter_id: updatedMeter.id,
        ems_mode: updatedMeter.ems_mode,
        max_power_kw: updatedMeter.max_power_kw ? Number(updatedMeter.max_power_kw) : null,
        updatedAt: updatedMeter.updated_at?.toISOString() || new Date().toISOString()
      };
      
      updatedMeters.push(serializedMeter);
      totalUpdated = 1;
      
      // 針對指定電表發送 OCPP 通知
      notifyOcpp({
        action: 'meter_settings_changed',
        data: serializedMeter
      });
      
    } else {
      // 沒有指定 meter_id，更新所有電表
      console.log(`🌐 [updateBalanceMode] 更新所有站點的所有電表`);
      
      for (const station of allStations) {
        if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
          console.log(`⚠️ [updateBalanceMode] 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
          continue;
        }
        
        console.log(`🏭 [updateBalanceMode] 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
        
        for (const meter of station.meters) {
          try {
            console.log(`⚡ [updateBalanceMode] 更新電表 ${meter.id} (${meter.name || '未命名'})`);
            
            // 更新電表的 EMS 模式
            const updatedMeter = await databaseService.updateMeter(meter.id, { ems_mode: emsMode });
            console.log(`✅ [updateBalanceMode] Updated meter ${meter.id} with ems_mode: "${emsMode}"`);
            
            const serializedMeter = {
              station_id: station.id,
              station_code: station.station_code,
              meter_id: updatedMeter.id,
              meter_name: meter.name || '未命名',
              ems_mode: updatedMeter.ems_mode,
              max_power_kw: updatedMeter.max_power_kw ? Number(updatedMeter.max_power_kw) : null,
              updatedAt: updatedMeter.updated_at?.toISOString() || new Date().toISOString()
            };
            
            updatedMeters.push(serializedMeter);
            totalUpdated++;
            
            // 為每個電表單獨發送 OCPP 通知
            notifyOcpp({
              action: 'meter_settings_changed',
              data: serializedMeter
            });
            
            // 加入小延遲避免過於頻繁的通知
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (meterError) {
            console.error(`❌ [updateBalanceMode] 更新電表 ${meter.id} 失敗:`, meterError);
          }
        }
      }
    }

    console.log(`🔍 [updateBalanceMode] 總共更新了 ${totalUpdated} 個電表`);
    console.log(`🔍 [updateBalanceMode] 更新結果:`, updatedMeters);

    revalidatePath('/api/stations');
    return { 
      success: true, 
      data: {
        total_updated: totalUpdated,
        updated_meters: updatedMeters,
        ems_mode: emsMode
      }
    };
  } catch (error) {
    console.error('Server action error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateMaxPower(formData) {
  try {
    const maxPowerKw = Number(formData.get('max_power_kw'));
    const meterId = formData.get('meter_id'); // 可選的電表ID
    
    if (isNaN(maxPowerKw)) {
      throw new Error('請輸入有效的功率數值 (kW)');
    }

    console.log(`🔍 [updateMaxPower] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    console.log(`🔍 [updateMaxPower] Updating max_power_kw to: ${maxPowerKw}`);
    console.log(`🔍 [updateMaxPower] Target meter_id: ${meterId || '全部電表'}`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 取得所有站點和電表
    const allStations = await databaseService.getStations();
    
    if (!allStations || allStations.length === 0) {
      throw new Error('No stations found');
    }

    let updatedMeters = [];
    let totalUpdated = 0;

    // 如果指定了 meter_id，只更新該電表
    if (meterId) {
      console.log(`🎯 [updateMaxPower] 更新指定電表 ${meterId}`);
      
      // 找到指定的電表
      let targetMeter = null;
      let targetStation = null;
      
      for (const station of allStations) {
        if (station.meters && Array.isArray(station.meters)) {
          const meter = station.meters.find(m => m.id === parseInt(meterId));
          if (meter) {
            targetMeter = meter;
            targetStation = station;
            break;
          }
        }
      }
      
      if (!targetMeter) {
        throw new Error(`Meter with ID ${meterId} not found`);
      }
      
      console.log(`🔍 [updateMaxPower] Found target meter: ${targetMeter.id} in station ${targetStation.id}`);
      
      // 更新指定電表
      const updatedMeter = await databaseService.updateMeter(targetMeter.id, { max_power_kw: maxPowerKw });
      console.log(`✅ [updateMaxPower] Updated meter ${targetMeter.id} with max_power_kw: ${maxPowerKw}`);
      
      const serializedMeter = {
        station_id: targetStation.id,
        station_code: targetStation.station_code,
        meter_id: updatedMeter.id,
        ems_mode: updatedMeter.ems_mode,
        max_power_kw: updatedMeter.max_power_kw ? Number(updatedMeter.max_power_kw) : null,
        updatedAt: updatedMeter.updated_at?.toISOString() || new Date().toISOString()
      };
      
      updatedMeters.push(serializedMeter);
      totalUpdated = 1;
      
      // 針對指定電表發送 OCPP 通知
      notifyOcpp({
        action: 'meter_settings_changed',
        data: serializedMeter
      });
      
    } else {
      // 沒有指定 meter_id，更新所有電表
      console.log(`🌐 [updateMaxPower] 更新所有站點的所有電表`);
      
      for (const station of allStations) {
        if (!station.meters || !Array.isArray(station.meters) || station.meters.length === 0) {
          console.log(`⚠️ [updateMaxPower] 站點 ${station.id} (${station.name}) 沒有電表，跳過`);
          continue;
        }
        
        console.log(`🏭 [updateMaxPower] 處理站點 ${station.id} (${station.name})，共 ${station.meters.length} 個電表`);
        
        for (const meter of station.meters) {
          try {
            console.log(`⚡ [updateMaxPower] 更新電表 ${meter.id} (${meter.name || '未命名'})`);
            
            // 更新電表的最大功率
            const updatedMeter = await databaseService.updateMeter(meter.id, { max_power_kw: maxPowerKw });
            console.log(`✅ [updateMaxPower] Updated meter ${meter.id} with max_power_kw: ${maxPowerKw}`);
            
            const serializedMeter = {
              station_id: station.id,
              station_code: station.station_code,
              meter_id: updatedMeter.id,
              meter_name: meter.name || '未命名',
              ems_mode: updatedMeter.ems_mode,
              max_power_kw: updatedMeter.max_power_kw ? Number(updatedMeter.max_power_kw) : null,
              updatedAt: updatedMeter.updated_at?.toISOString() || new Date().toISOString()
            };
            
            updatedMeters.push(serializedMeter);
            totalUpdated++;
            
            // 為每個電表單獨發送 OCPP 通知
            notifyOcpp({
              action: 'meter_settings_changed',
              data: serializedMeter
            });
            
            // 加入小延遲避免過於頻繁的通知
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (meterError) {
            console.error(`❌ [updateMaxPower] 更新電表 ${meter.id} 失敗:`, meterError);
          }
        }
      }
    }

    console.log(`🔍 [updateMaxPower] 總共更新了 ${totalUpdated} 個電表`);
    console.log(`🔍 [updateMaxPower] 更新結果:`, updatedMeters);

    revalidatePath('/api/stations');
    return { 
      success: true, 
      data: {
        total_updated: totalUpdated,
        updated_meters: updatedMeters,
        max_power_kw: maxPowerKw
      }
    };
  } catch (error) {
    console.error('Server action error:', error);
    return { success: false, error: error.message };
  }
}

export async function createStationAction(formData) {
  try {
    // Simple validation
    const station_code = formData.get('station_code');
    const name = formData.get('name');
    const address = formData.get('address');
    const floor = formData.get('floor');
    const operator_id = formData.get('operator_id');

    if (!station_code) {
      return { success: false, error: '請提供場域代碼 (station_code)'};
    }

    console.log(`🔍 [createStationAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);

    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const created = await databaseService.createStation({
      station_code: String(station_code),
      name: name ? String(name) : undefined,
      address: address ? String(address) : undefined,
      floor: floor ? String(floor) : undefined,
      operator_id: operator_id ? String(operator_id) : undefined
    });

    // Revalidate stations list if pages rely on it (guard in case revalidatePath is unavailable)
    try {
      if (typeof revalidatePath === 'function') {
        revalidatePath('/api/stations');
      } else {
        console.warn('[createStationAction] revalidatePath is not available in this runtime');
      }
    } catch (err) {
      console.warn('[createStationAction] revalidatePath error:', err);
    }

    return { success: true, data: created };
  } catch (error) {
    console.error('createStationAction error:', error);
    // Prisma unique constraint error handling
    const errMsg = (error && error.code === 'P2002') ? '場域代碼已存在，請使用其他代碼' : (error instanceof Error ? error.message : String(error));
    return { success: false, error: errMsg };
  }
}
