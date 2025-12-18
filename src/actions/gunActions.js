"use server";

import { revalidatePath } from 'next/cache';

// 直接使用資料庫服務
import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';

export async function createGunAction(formData) {
  try {
    console.log(`🔍 [createGunAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 從 formData 取得資料
    const cpid = formData.get('cpid');
    const connector = formData.get('connector');
    const cpsn = formData.get('cpsn');
    const acdc = formData.get('acdc');
    const maxKw = formData.get('max_kw');
    const gunsMemo1 = formData.get('guns_memo1');
    const meterId = formData.get('meter_id');
    const chargingStandardId = formData.get('charging_standard_id');
    const tariffIdsStr = formData.get('tariff_ids');
    const tariffDataStr = formData.get('tariff_data');
    
    // 建構資料物件
    const data = {};
    if (cpid) data.cpid = cpid;
    if (connector) data.connector = connector;
    if (cpsn) data.cpsn = cpsn;
    if (acdc) data.acdc = acdc;
    if (maxKw) data.max_kw = Number(maxKw);
    if (gunsMemo1) data.guns_memo1 = gunsMemo1;
    if (meterId) data.meter_id = Number(meterId);
    if (chargingStandardId) data.charging_standard_id = Number(chargingStandardId);
    
    // 預設狀態為 'Unavailable'
    data.guns_status = 'Unavailable';
    
    if (Object.keys(data).length === 0) {
      return {
        success: false,
        error: '請提供有效的資料'
      };
    }
    
    // 建立新的充電槍
    const created = await databaseService.createGun(data);
    console.log(`✅ [createGunAction] Created gun:`, created.id);
    
    // 如果提供了費率資料，創建gun-tariff關聯
    if (tariffDataStr) {
      try {
        const tariffData = JSON.parse(tariffDataStr);
        if (Array.isArray(tariffData) && tariffData.length > 0) {
            const seen = new Set();
            for (const item of tariffData) {
              const tariffId = parseInt(item.tariffId);
              const priority = parseInt(item.priority) || 1;
              if (isNaN(tariffId)) continue;
              if (seen.has(tariffId)) {
                console.warn(`[createGunAction] duplicate tariffId ${tariffId} in payload, skipping`);
                continue;
              }
              seen.add(tariffId);
              await databaseService.createGunTariff({
                gun_id: created.id,
                tariff_id: tariffId,
                priority: priority,
                is_active: true
              });
              console.log(`✅ [createGunAction] Created gun-tariff association: gun ${created.id} -> tariff ${tariffId} (priority: ${priority})`);
            }
        }
      } catch (error) {
        console.error('Failed to create gun-tariff associations:', error);
        // 不阻擋槍的創建，只記錄錯誤
      }
    }
    
    // 向後兼容：如果提供了舊格式的tariff_ids，也處理
    if (tariffIdsStr && !tariffDataStr) {
      try {
        const tariffIds = JSON.parse(tariffIdsStr);
        if (Array.isArray(tariffIds) && tariffIds.length > 0) {
            const seen = new Set();
            for (let i = 0; i < tariffIds.length; i++) {
              const tariffId = parseInt(tariffIds[i]);
              if (isNaN(tariffId)) continue;
              if (seen.has(tariffId)) continue;
              seen.add(tariffId);
              await databaseService.createGunTariff({
                gun_id: created.id,
                tariff_id: tariffId,
                priority: i + 1, // 按選擇順序設置優先級
                is_active: true
              });
              console.log(`✅ [createGunAction] Created gun-tariff association (legacy): gun ${created.id} -> tariff ${tariffId}`);
            }
        }
      } catch (error) {
        console.error('Failed to create gun-tariff associations (legacy):', error);
        // 不阻擋槍的創建，只記錄錯誤
      }
    }
    
    // 將 Decimal 等物件轉換為可序列化的格式
    const serializedData = {
      id: created.id,
      cpid: created.cpid,
      connector: created.connector,
      cpsn: created.cpsn,
      acdc: created.acdc,
      max_kw: created.max_kw ? Number(created.max_kw) : null,
      guns_memo1: created.guns_memo1,
      guns_status: created.guns_status,
      meter_id: created.meter_id,
      createdAt: created.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: created.updatedAt?.toISOString() || new Date().toISOString()
    };
    
    // 重新驗證相關頁面和API
    revalidatePath('/api/guns');
    revalidatePath('/charging_status');
    
    return { success: true, data: serializedData };
  } catch (error) {
    console.error('Create gun action error:', error);
    return {
      success: false,
      error: error.message || '新增充電樁失敗'
    };
  }
}

export async function updateGunAction(formData) {
  try {
    console.log(`🔍 [updateGunAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const gunIdString = formData.get('id');
    if (!gunIdString) {
      return {
        success: false,
        error: '請提供充電樁 ID'
      };
    }
    
    // 將 ID 轉換為數字，因為 Prisma 期望 Int 類型
    const gunId = parseInt(gunIdString, 10);
    if (isNaN(gunId)) {
      return {
        success: false,
        error: '無效的充電樁 ID'
      };
    }
    
    // 從 formData 取得更新資料
    const data = {};
    const cpid = formData.get('cpid');
    const connector = formData.get('connector');
    const cpsn = formData.get('cpsn');
    const acdc = formData.get('acdc');
    const maxKw = formData.get('max_kw');
    const gunsMemo1 = formData.get('guns_memo1');
    const gunsStatus = formData.get('guns_status');
    const chargingStandardId = formData.get('charging_standard_id');
    const tariffDataStr = formData.get('tariff_data');
    
    if (cpid !== null) data.cpid = cpid;
    if (connector !== null) data.connector = connector;
    if (cpsn !== null) data.cpsn = cpsn;
    if (acdc !== null) data.acdc = acdc;
    if (maxKw !== null) data.max_kw = Number(maxKw);
    if (gunsMemo1 !== null) data.guns_memo1 = gunsMemo1;
    if (gunsStatus !== null) data.guns_status = gunsStatus;
    if (chargingStandardId !== null) data.charging_standard_id = Number(chargingStandardId);
    
    if (Object.keys(data).length === 0 && !tariffDataStr) {
      return {
        success: false,
        error: '沒有提供更新資料'
      };
    }
    
    // 更新充電槍基本資料
    let updated = null;
    if (Object.keys(data).length > 0) {
      updated = await databaseService.updateGun(gunId, data);
      console.log(`✅ [updateGunAction] Updated gun:`, updated.id);
    }
    
    // 處理費率配置更新
    if (tariffDataStr) {
      try {
        // 使用事務（transaction）先刪除再批量建立，並跳過重複項以避免 unique constraint 錯誤
        const tariffData = JSON.parse(tariffDataStr);
        const entries = [];
        const seen = new Set();
        if (Array.isArray(tariffData) && tariffData.length > 0) {
          for (const item of tariffData) {
            const tariffId = parseInt(item.tariffId);
            const priority = parseInt(item.priority) || 1;
            if (isNaN(tariffId)) continue;
            if (seen.has(tariffId)) continue;
            seen.add(tariffId);
            entries.push({ gun_id: gunId, tariff_id: tariffId, priority: priority, is_active: true, createdAt: new Date(), updatedAt: new Date() });
          }
        }

        await databaseService.withTransaction(async (prisma) => {
          // 刪除舊的關聯
          await prisma.gun_tariffs.deleteMany({ where: { gun_id: gunId } });

          // 批量建立新的關聯（skipDuplicates 防止重複鍵錯誤）
          if (entries.length > 0) {
            await prisma.gun_tariffs.createMany({ data: entries, skipDuplicates: true });
            console.log(`✅ [updateGunAction] Re-created ${entries.length} gun-tariff associations for gun ${gunId}`);
          } else {
            console.log(`✅ [updateGunAction] Cleared gun-tariff associations for gun ${gunId}`);
          }
        });
      } catch (error) {
        console.error('Failed to update gun-tariff associations:', error);
        return {
          success: false,
          error: '更新費率配置失敗: ' + error.message
        };
      }
    }
    
    // 如果沒有更新基本資料，需要重新獲取充電槍資料
    if (!updated) {
      updated = await databaseService.getGunById(gunId);
    }
    
    // 將 Decimal 等物件轉換為可序列化的格式
    const serializedData = {
      id: updated.id,
      cpid: updated.cpid,
      connector: updated.connector,
      cpsn: updated.cpsn,
      acdc: updated.acdc,
      max_kw: updated.max_kw ? Number(updated.max_kw) : null,
      guns_memo1: updated.guns_memo1,
      guns_status: updated.guns_status,
      createdAt: updated.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: updated.updatedAt?.toISOString() || new Date().toISOString()
    };
    
    // 重新驗證相關頁面和API
    revalidatePath('/api/guns');
    revalidatePath('/charging_status');
    
    return { success: true, data: serializedData };
  } catch (error) {
    console.error('Update gun action error:', error);
    return {
      success: false,
      error: error.message || '更新充電樁失敗'
    };
  }
}

export async function deleteGunAction(formData) {
  try {
    console.log(`🔍 [deleteGunAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const gunIdString = formData.get('id');
    if (!gunIdString) {
      return {
        success: false,
        error: '請提供充電樁 ID'
      };
    }
    
    // 將 ID 轉換為數字，因為 Prisma 期望 Int 類型
    const gunId = parseInt(gunIdString, 10);
    if (isNaN(gunId)) {
      return {
        success: false,
        error: '無效的充電樁 ID'
      };
    }
    
    // 刪除充電槍
    await databaseService.deleteGun(gunId);
    console.log(`✅ [deleteGunAction] Deleted gun:`, gunId);
    
    // 重新驗證相關頁面和API
    revalidatePath('/api/guns');
    revalidatePath('/charging_status');
    
    return { success: true };
  } catch (error) {
    console.error('Delete gun action error:', error);
    return {
      success: false,
      error: error.message || '刪除充電樁失敗'
    };
  }
}
