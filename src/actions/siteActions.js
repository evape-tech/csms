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
    // 使用新的API端點触发全站功率重新分配
    const triggerPayload = {
      source: payload?.action || 'site_setting_changed',
      timestamp: new Date().toISOString(),
      userAgent: 'NextJS-Server-Action',
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

export async function updateBalanceMode(formData) {
  try {
    const emsMode = formData.get('ems_mode');
    
    console.log(`🔍 [updateBalanceMode] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    console.log(`🔍 [updateBalanceMode] Updating ems_mode to: "${emsMode}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 取得現有設定
    const existingSettings = await databaseService.getSiteSettings();
    const existing = existingSettings.length > 0 ? existingSettings[0] : null;
    
    if (!existing) {
      throw new Error('No site_settings row found');
    }

    console.log(`🔍 [updateBalanceMode] Current ems_mode: "${existing.ems_mode}" -> "${emsMode}"`);

    // 更新資料庫
    const updated = await databaseService.updateSiteSettings(existing.id, { ems_mode: emsMode });
    console.log(`✅ [updateBalanceMode] Updated site_setting:`, updated.id);
    console.log(`✅ [updateBalanceMode] New ems_mode in DB: "${updated.ems_mode}"`);

    // 將 Decimal 轉換為普通數字以避免序列化問題
    const serializedData = {
      id: updated.id,
      ems_mode: updated.ems_mode,
      max_power_kw: updated.max_power_kw ? Number(updated.max_power_kw) : null,
      updatedAt: updated.updatedAt?.toISOString() || new Date().toISOString()
    };

    console.log(`🔍 [updateBalanceMode] Returning serialized data:`, serializedData);

    // 非阻塞通知 OCPP 服務
    notifyOcpp({
      action: 'site_setting_changed',
      data: serializedData
    });

    revalidatePath('/api/site_setting');
    return { success: true, data: serializedData };
  } catch (error) {
    console.error('Server action error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateMaxPower(formData) {
  try {
    const maxPowerKw = Number(formData.get('max_power_kw'));
    
    if (isNaN(maxPowerKw)) {
      throw new Error('請輸入有效的功率數值 (kW)');
    }

    console.log(`🔍 [updateMaxPower] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 取得現有設定
    const existingSettings = await databaseService.getSiteSettings();
    const existing = existingSettings.length > 0 ? existingSettings[0] : null;
    
    if (!existing) {
      throw new Error('No site_settings row found');
    }

    // 更新資料庫
    const updated = await databaseService.updateSiteSettings(existing.id, { max_power_kw: maxPowerKw });
    console.log(`✅ [updateMaxPower] Updated site_setting:`, updated.id);

    // 將 Decimal 轉換為普通數字以避免序列化問題
    const serializedData = {
      id: updated.id,
      ems_mode: updated.ems_mode,
      max_power_kw: updated.max_power_kw ? Number(updated.max_power_kw) : null,
      updatedAt: updated.updatedAt?.toISOString() || new Date().toISOString()
    };

    // 非阻塞通知 OCPP 服務
    notifyOcpp({
      action: 'site_setting_changed',
      data: serializedData
    });

    revalidatePath('/api/site_setting');
    return { success: true, data: serializedData };
  } catch (error) {
    console.error('Server action error:', error);
    return { success: false, error: error.message };
  }
}
