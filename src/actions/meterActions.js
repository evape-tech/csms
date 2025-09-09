"use server";

import { revalidatePath } from 'next/cache';

// 直接使用資料庫服務，避免繞過 API 路由
import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';

export async function createMeterAction(formData) {
  try {
    const stationId = formData.get('station_id');
    const meterNo = formData.get('meter_no');
    const emsMode = formData.get('ems_mode') || 'static';
    const maxPowerKw = formData.get('max_power_kw') || '480';
    const billingMode = formData.get('billing_mode');
    const ownerId = formData.get('owner_id');

    console.log(`🔍 [createMeterAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    console.log(`🔍 [createMeterAction] Creating meter with:`, {
      station_id: stationId,
      meter_no: meterNo,
      ems_mode: emsMode,
      max_power_kw: maxPowerKw,
      billing_mode: billingMode,
      owner_id: ownerId
    });

    // 驗證必填字段
    if (!stationId) {
      throw new Error('請選擇站點');
    }
    if (!meterNo) {
      throw new Error('請輸入電表編號');
    }

    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 建立電表資料
    const meterData = {
      station_id: parseInt(stationId),
      meter_no: meterNo,
      ems_mode: emsMode,
      max_power_kw: parseFloat(maxPowerKw),
    };

    if (billingMode) meterData.billing_mode = billingMode;
    if (ownerId) meterData.owner_id = ownerId;

    // 呼叫資料庫服務建立電表
    const newMeter = await databaseService.createMeter(meterData);

    console.log(`✅ [createMeterAction] Created meter:`, newMeter);

    revalidatePath('/api/stations');
    return {
      success: true,
      data: newMeter
    };
  } catch (error) {
    console.error('Server action error:', error);
    return { success: false, error: error.message };
  }
}
