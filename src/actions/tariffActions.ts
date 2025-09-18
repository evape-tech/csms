'use server';

import { revalidatePath } from 'next/cache';
import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

// 序列化費率資料，將 Decimal 轉換為數字
function serializeTariff(tariff: any) {
  return {
    ...tariff,
    base_price: tariff.base_price ? Number(tariff.base_price) : null,
    service_fee: tariff.service_fee ? Number(tariff.service_fee) : null,
    minimum_fee: tariff.minimum_fee ? Number(tariff.minimum_fee) : null,
    peak_hours_price: tariff.peak_hours_price ? Number(tariff.peak_hours_price) : null,
    off_peak_price: tariff.off_peak_price ? Number(tariff.off_peak_price) : null,
    weekend_price: tariff.weekend_price ? Number(tariff.weekend_price) : null,
    tier1_max_kwh: tariff.tier1_max_kwh ? Number(tariff.tier1_max_kwh) : null,
    tier1_price: tariff.tier1_price ? Number(tariff.tier1_price) : null,
    tier2_max_kwh: tariff.tier2_max_kwh ? Number(tariff.tier2_max_kwh) : null,
    tier2_price: tariff.tier2_price ? Number(tariff.tier2_price) : null,
    tier3_price: tariff.tier3_price ? Number(tariff.tier3_price) : null,
    discount_percentage: tariff.discount_percentage ? Number(tariff.discount_percentage) : null,
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
    const service_fee = formData.get('service_fee') ? parseFloat(formData.get('service_fee') as string) : null;
    const minimum_fee = formData.get('minimum_fee') ? parseFloat(formData.get('minimum_fee') as string) : null;
    const peak_hours_start = formData.get('peak_hours_start') as string || null;
    const peak_hours_end = formData.get('peak_hours_end') as string || null;
    const peak_hours_price = formData.get('peak_hours_price') ? parseFloat(formData.get('peak_hours_price') as string) : null;
    const off_peak_price = formData.get('off_peak_price') ? parseFloat(formData.get('off_peak_price') as string) : null;
    const weekend_price = formData.get('weekend_price') ? parseFloat(formData.get('weekend_price') as string) : null;
    const is_active = formData.get('is_active') === 'true';
    const is_default = formData.get('is_default') === 'true';

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
        service_fee,
        minimum_fee,
        peak_hours_start,
        peak_hours_end,
        peak_hours_price,
        off_peak_price,
        weekend_price,
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
    const service_fee = formData.get('service_fee') ? parseFloat(formData.get('service_fee') as string) : null;
    const minimum_fee = formData.get('minimum_fee') ? parseFloat(formData.get('minimum_fee') as string) : null;
    const peak_hours_start = formData.get('peak_hours_start') as string || null;
    const peak_hours_end = formData.get('peak_hours_end') as string || null;
    const peak_hours_price = formData.get('peak_hours_price') ? parseFloat(formData.get('peak_hours_price') as string) : null;
    const off_peak_price = formData.get('off_peak_price') ? parseFloat(formData.get('off_peak_price') as string) : null;
    const weekend_price = formData.get('weekend_price') ? parseFloat(formData.get('weekend_price') as string) : null;
    const is_active = formData.get('is_active') === 'true';
    const is_default = formData.get('is_default') === 'true';

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
        service_fee,
        minimum_fee,
        peak_hours_start,
        peak_hours_end,
        peak_hours_price,
        off_peak_price,
        weekend_price,
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
