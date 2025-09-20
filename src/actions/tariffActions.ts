'use server';

import { revalidatePath } from 'next/cache';
import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

// 序列化費率資料，將 Decimal 轉換為數字
function serializeTariff(tariff: any) {
  return {
    ...tariff,
    base_price: tariff.base_price ? Number(tariff.base_price) : null,
    charging_parking_fee: tariff.charging_parking_fee ? Number(tariff.charging_parking_fee) : null,
    peak_hours_price: tariff.peak_hours_price ? Number(tariff.peak_hours_price) : null,
    off_peak_price: tariff.off_peak_price ? Number(tariff.off_peak_price) : null,
    weekend_price: tariff.weekend_price ? Number(tariff.weekend_price) : null,
    tier1_max_kwh: tariff.tier1_max_kwh ? Number(tariff.tier1_max_kwh) : null,
    tier1_price: tariff.tier1_price ? Number(tariff.tier1_price) : null,
    tier2_max_kwh: tariff.tier2_max_kwh ? Number(tariff.tier2_max_kwh) : null,
    tier2_price: tariff.tier2_price ? Number(tariff.tier2_price) : null,
    tier3_price: tariff.tier3_price ? Number(tariff.tier3_price) : null,
    discount_percentage: tariff.discount_percentage ? Number(tariff.discount_percentage) : null,
    penalty_rate_per_hour: tariff.penalty_rate_per_hour ? Number(tariff.penalty_rate_per_hour) : null,
  };
}

// 獲取所有費率方案
export async function getTariffs() {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const tariffs = await client.tariffs.findMany({
      orderBy: [
        { is_default: 'desc' },
        { is_active: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // 轉換 Decimal 物件為數字，確保可以傳遞給客戶端組件
    const serializedTariffs = tariffs.map(serializeTariff);

    return { success: true, data: serializedTariffs };
  } catch (error) {
    console.error('Error fetching tariffs:', error);
    return { success: false, error: error instanceof Error ? error.message : '獲取費率方案失敗' };
  }
}

// 創建新費率方案
export async function createTariff(formData: FormData) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const tariff_type = formData.get('tariff_type') as string;
    const base_price = parseFloat(formData.get('base_price') as string);
    const charging_parking_fee = formData.get('charging_parking_fee') ? parseFloat(formData.get('charging_parking_fee') as string) : null;
    const peak_hours_start = formData.get('peak_hours_start') as string || null;
    const peak_hours_end = formData.get('peak_hours_end') as string || null;
    const peak_hours_price = formData.get('peak_hours_price') ? parseFloat(formData.get('peak_hours_price') as string) : null;
    const off_peak_price = formData.get('off_peak_price') ? parseFloat(formData.get('off_peak_price') as string) : null;
    const weekend_price = formData.get('weekend_price') ? parseFloat(formData.get('weekend_price') as string) : null;
    const tier1_max_kwh = formData.get('tier1_max_kwh') ? parseFloat(formData.get('tier1_max_kwh') as string) : null;
    const tier1_price = formData.get('tier1_price') ? parseFloat(formData.get('tier1_price') as string) : null;
    const tier2_max_kwh = formData.get('tier2_max_kwh') ? parseFloat(formData.get('tier2_max_kwh') as string) : null;
    const tier2_price = formData.get('tier2_price') ? parseFloat(formData.get('tier2_price') as string) : null;
    const tier3_price = formData.get('tier3_price') ? parseFloat(formData.get('tier3_price') as string) : null;
    const discount_percentage = formData.get('discount_percentage') ? parseFloat(formData.get('discount_percentage') as string) : null;
    const promotion_code = formData.get('promotion_code') as string || null;
    const valid_from = formData.get('valid_from') ? new Date(formData.get('valid_from') as string) : null;
    const valid_to = formData.get('valid_to') ? new Date(formData.get('valid_to') as string) : null;
    const season_type = formData.get('season_type') as string || 'ALL_YEAR';
    const season_start_month = formData.get('season_start_month') ? parseInt(formData.get('season_start_month') as string) : null;
    const season_end_month = formData.get('season_end_month') ? parseInt(formData.get('season_end_month') as string) : null;
    const grace_period_minutes = formData.get('grace_period_minutes') ? parseInt(formData.get('grace_period_minutes') as string) : 15;
    const penalty_rate_per_hour = formData.get('penalty_rate_per_hour') ? parseFloat(formData.get('penalty_rate_per_hour') as string) : null;
    const ac_only = formData.get('ac_only') === 'on';
    const dc_only = formData.get('dc_only') === 'on';
    const membership_required = formData.get('membership_required') === 'on';
    const is_active = formData.get('is_active') !== 'false';
    const is_default = formData.get('is_default') === 'on';

    if (!name || !tariff_type || base_price == null) {
      throw new Error('名稱、費率類型和基本價格為必填項');
    }

    // 如果設為預設，將其他費率方案的預設狀態取消
    if (is_default) {
      await client.tariffs.updateMany({
        where: { is_default: true },
        data: { is_default: false }
      });
    }

    const newTariff = await client.tariffs.create({
      data: {
        name,
        description,
        tariff_type,
        base_price,
        charging_parking_fee,
        peak_hours_start,
        peak_hours_end,
        peak_hours_price,
        off_peak_price,
        weekend_price,
        tier1_max_kwh,
        tier1_price,
        tier2_max_kwh,
        tier2_price,
        tier3_price,
        discount_percentage,
        promotion_code,
        valid_from,
        valid_to,
        season_type,
        season_start_month,
        season_end_month,
        grace_period_minutes,
        penalty_rate_per_hour,
        ac_only,
        dc_only,
        membership_required,
        is_active,
        is_default,
        created_by: 'admin' // 這裡可以根據實際的使用者資訊設定
      }
    });

    revalidatePath('/tariff_management');
    return { success: true, data: serializeTariff(newTariff) };
  } catch (error) {
    console.error('Error creating tariff:', error);
    return { success: false, error: error instanceof Error ? error.message : '新增費率方案失敗' };
  }
}

// 更新費率方案
export async function updateTariff(tariffId: number, formData: FormData) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const tariff_type = formData.get('tariff_type') as string;
    const base_price = parseFloat(formData.get('base_price') as string);
    const charging_parking_fee = formData.get('charging_parking_fee') ? parseFloat(formData.get('charging_parking_fee') as string) : null;
    const peak_hours_start = formData.get('peak_hours_start') as string || null;
    const peak_hours_end = formData.get('peak_hours_end') as string || null;
    const peak_hours_price = formData.get('peak_hours_price') ? parseFloat(formData.get('peak_hours_price') as string) : null;
    const off_peak_price = formData.get('off_peak_price') ? parseFloat(formData.get('off_peak_price') as string) : null;
    const weekend_price = formData.get('weekend_price') ? parseFloat(formData.get('weekend_price') as string) : null;
    const tier1_max_kwh = formData.get('tier1_max_kwh') ? parseFloat(formData.get('tier1_max_kwh') as string) : null;
    const tier1_price = formData.get('tier1_price') ? parseFloat(formData.get('tier1_price') as string) : null;
    const tier2_max_kwh = formData.get('tier2_max_kwh') ? parseFloat(formData.get('tier2_max_kwh') as string) : null;
    const tier2_price = formData.get('tier2_price') ? parseFloat(formData.get('tier2_price') as string) : null;
    const tier3_price = formData.get('tier3_price') ? parseFloat(formData.get('tier3_price') as string) : null;
    const discount_percentage = formData.get('discount_percentage') ? parseFloat(formData.get('discount_percentage') as string) : null;
    const promotion_code = formData.get('promotion_code') as string || null;
    const valid_from = formData.get('valid_from') ? new Date(formData.get('valid_from') as string) : null;
    const valid_to = formData.get('valid_to') ? new Date(formData.get('valid_to') as string) : null;
    const season_type = formData.get('season_type') as string || 'ALL_YEAR';
    const season_start_month = formData.get('season_start_month') ? parseInt(formData.get('season_start_month') as string) : null;
    const season_end_month = formData.get('season_end_month') ? parseInt(formData.get('season_end_month') as string) : null;
    const grace_period_minutes = formData.get('grace_period_minutes') ? parseInt(formData.get('grace_period_minutes') as string) : 15;
    const penalty_rate_per_hour = formData.get('penalty_rate_per_hour') ? parseFloat(formData.get('penalty_rate_per_hour') as string) : null;
    const ac_only = formData.get('ac_only') === 'on';
    const dc_only = formData.get('dc_only') === 'on';
    const membership_required = formData.get('membership_required') === 'on';
    const is_active = formData.get('is_active') !== 'false';
    const is_default = formData.get('is_default') === 'on';

    if (!name || !tariff_type || base_price == null) {
      throw new Error('名稱、費率類型和基本價格為必填項');
    }

    // 如果設為預設，將其他費率方案的預設狀態取消
    if (is_default) {
      await client.tariffs.updateMany({
        where: { 
          is_default: true,
          id: { not: tariffId }
        },
        data: { is_default: false }
      });
    }

    const updatedTariff = await client.tariffs.update({
      where: { id: tariffId },
      data: {
        name,
        description,
        tariff_type,
        base_price,
        charging_parking_fee,
        peak_hours_start,
        peak_hours_end,
        peak_hours_price,
        off_peak_price,
        weekend_price,
        tier1_max_kwh,
        tier1_price,
        tier2_max_kwh,
        tier2_price,
        tier3_price,
        discount_percentage,
        promotion_code,
        valid_from,
        valid_to,
        season_type,
        season_start_month,
        season_end_month,
        grace_period_minutes,
        penalty_rate_per_hour,
        ac_only,
        dc_only,
        membership_required,
        is_active,
        is_default
      }
    });

    revalidatePath('/tariff_management');
    return { success: true, data: serializeTariff(updatedTariff) };
  } catch (error) {
    console.error('Error updating tariff:', error);
    return { success: false, error: error instanceof Error ? error.message : '更新費率方案失敗' };
  }
}

// 刪除費率方案
export async function deleteTariff(tariffId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 檢查是否有關聯的記錄
    const relatedRecords = await client.billing_records.count({
      where: { tariff_id: tariffId }
    });

    const relatedStations = await client.stations.count({
      where: { tariff_id: tariffId }
    });

    if (relatedRecords > 0 || relatedStations > 0) {
      throw new Error('該費率方案有關聯的計費記錄或站點，無法刪除');
    }

    await client.tariffs.delete({
      where: { id: tariffId }
    });

    revalidatePath('/tariff_management');
    return { success: true };
  } catch (error) {
    console.error('Error deleting tariff:', error);
    return { success: false, error: error instanceof Error ? error.message : '刪除費率方案失敗' };
  }
}

// 切換費率方案狀態
export async function toggleTariffStatus(tariffId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 獲取當前狀態
    const tariff = await client.tariffs.findUnique({
      where: { id: tariffId }
    });

    if (!tariff) {
      throw new Error('費率方案不存在');
    }

    const updatedTariff = await client.tariffs.update({
      where: { id: tariffId },
      data: { is_active: !tariff.is_active }
    });

    revalidatePath('/tariff_management');
    return { success: true, data: serializeTariff(updatedTariff) };
  } catch (error) {
    console.error('Error toggling tariff status:', error);
    return { success: false, error: error instanceof Error ? error.message : '切換狀態失敗' };
  }
}

// 設定為預設費率方案
export async function setDefaultTariff(tariffId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 將所有費率方案的預設狀態取消
    await client.tariffs.updateMany({
      data: { is_default: false }
    });

    // 設定指定的費率方案為預設
    const updatedTariff = await client.tariffs.update({
      where: { id: tariffId },
      data: { is_default: true, is_active: true }
    });

    revalidatePath('/tariff_management');
    return { success: true, data: serializeTariff(updatedTariff) };
  } catch (error) {
    console.error('Error setting default tariff:', error);
    return { success: false, error: error instanceof Error ? error.message : '設定預設費率方案失敗' };
  }
}
