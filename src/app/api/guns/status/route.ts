import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';
import { tariffRepository } from '../../../../servers/repositories/index.js';
import { calculateRateByType } from '../../../../lib/rateCalculator.js';
import { logger } from '../../../../servers/utils/index.js';

// 強制動態渲染
export const dynamic = 'force-dynamic';

/**
 * 計算實時充電費用
 * @param transaction - 充電交易資料
 * @param gunId - 充電槍ID
 * @returns 費用資訊或null
 */
async function calculateRealtimeCost(transaction: any, gunId: number) {
  try {
    // 檢查是否有充電量
    if (!transaction.energy_consumed || parseFloat(transaction.energy_consumed) <= 0) {
      return null;
    }

    // 獲取適用的費率方案
    const chargingTime = transaction.start_time || new Date();
    // 先嘗試取得場域時區，傳入 getTariffForGun 以便正確判斷季節
    let tariffTimeZone: string | undefined = undefined;
    try {
      const station: any = await databaseService.getStationByGunId(gunId);
      if (station && (station as any).time_zone) tariffTimeZone = (station as any).time_zone;
    } catch (err: any) {
      logger.warn(`⚠️ [calculateRealtimeCost] 取得場域時區(選tariff)失敗，將使用預設: ${err?.message ?? String(err)}`);
    }
    const tariff: any = await tariffRepository.getTariffForGun(gunId, chargingTime, { timeZone: tariffTimeZone });

    if (!tariff) {
      console.warn(`⚠️ [calculateRealtimeCost] 未找到費率方案 for gun ${gunId}`);
      return null;
    }

    // 若為 TIME_OF_USE，嘗試取得場域時區，找不到則使用 'UTC'
    let timeZone: string | undefined = undefined;
    if (tariff && (tariff as any).tariff_type === 'TIME_OF_USE') {
      try {
        const station: any = await databaseService.getStationByGunId(gunId);
        if (station && (station as any).time_zone) timeZone = (station as any).time_zone;
      } catch (err: any) {
        logger.warn('⚠️ [calculateRealtimeCost] 取得場域時區失敗，將使用 UTC', err);
      }
      if (!timeZone) timeZone = 'UTC';
    }

    const result = calculateRateByType(transaction, tariff, { timeZone }) as any;
    const { energyFee, appliedPrice, discountAmount, billingDetails } = result;

    return {
      tariff_id: (tariff as any).id,
      tariff_name: (tariff as any).name,
      tariff_type: (tariff as any).tariff_type,
      energy_consumed: parseFloat(transaction.energy_consumed),
      applied_price: appliedPrice,
      energy_fee: parseFloat(energyFee.toFixed(2)),
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      estimated_total: parseFloat((energyFee - discountAmount).toFixed(2)),
      currency: 'TWD',
      billing_details: billingDetails,
      calculation_time: new Date().toISOString()
    };
  } catch (error: any) {
    logger.error(`❌ [calculateRealtimeCost] 計算費用失敗:`, error);
    return null;
  }
}

/**
 * 輔助函數：為 gun 資料附加對應的 transaction 資訊以及實時費用
 * 如果 gun.transactionid 有值，會查詢對應的 charging_transactions 並計算實時費用
 */
async function attachTransactionToGun(gun: any) {
  const baseData = {
    id: gun.id,
    cpid: gun.cpid,
    cpsn: gun.cpsn,
    connector: gun.connector,
    guns_status: gun.guns_status,
    acdc: gun.acdc,
    max_kw: gun.max_kw,
    guns_memo1: gun.guns_memo1,
    transactionid: gun.transactionid,
    createdAt: gun.createdAt,
    updatedAt: gun.updatedAt
  };

  // 如果有 transactionid，查詢對應的 transaction
  if (gun.transactionid && gun.transactionid.trim() !== '') {
    try {
      // 先嘗試用 transaction_id (字串) 查詢
      let transaction = await databaseService.getTransaction(gun.transactionid);
      
      // 如果找不到，且 transactionid 是數字，則嘗試用 id (主鍵) 查詢
      if (!transaction && !isNaN(Number(gun.transactionid))) {
        transaction = await databaseService.getTransactionById(Number(gun.transactionid));
      }
      
      if (transaction) {
        // 計算實時費用
        const realtimeCost = await calculateRealtimeCost(transaction, gun.id);
        
        return {
          ...baseData,
          transaction: {
            id: Number(transaction.id),
            transaction_id: transaction.transaction_id,
            start_time: transaction.start_time,
            end_time: transaction.end_time,
            cpid: transaction.cpid,
            cpsn: transaction.cpsn,
            connector_id: transaction.connector_id,
            user_id: transaction.user_id,
            id_tag: transaction.id_tag,
            meter_start: transaction.meter_start ? Number(transaction.meter_start) : null,
            meter_stop: transaction.meter_stop ? Number(transaction.meter_stop) : null,
            energy_consumed: transaction.energy_consumed ? Number(transaction.energy_consumed) : null,
            current_power: transaction.current_power ? Number(transaction.current_power) : null,
            current_voltage: transaction.current_voltage ? Number(transaction.current_voltage) : null,
            current_current: transaction.current_current ? Number(transaction.current_current) : null,
            last_meter_update: transaction.last_meter_update,
            charging_duration: transaction.charging_duration,
            status: transaction.status,
            stop_reason: transaction.stop_reason,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
          },
          realtime_cost: realtimeCost
        };
      }
    } catch (error) {
      console.warn(`⚠️ [attachTransactionToGun] Failed to fetch transaction ${gun.transactionid}:`, error);
      // 即使查詢失敗，也返回基本資料
    }
  }

  // 沒有 transactionid 或查詢失敗，只返回 gun 基本資料
  return baseData;
}

/**
 * 查詢充電樁狀態 API
 * 
 * 用途：查詢所有充電樁或特定充電樁的狀態資訊
 * 功能：當充電槍正在充電時（有 transaction），自動計算並返回實時費用
 * 
 * 查詢參數：
 * - cpid: 充電樁 ID（選填）
 * - cpsn: 充電樁序號（選填）
 * - id: 充電樁資料庫 ID（選填）
 * 
 * @route GET /api/guns/status
 * @route GET /api/guns/status?cpid=xxx
 * @route GET /api/guns/status?cpsn=xxx
 * @route GET /api/guns/status?id=xxx
 * 
 * @returns { 
 *   success: boolean, 
 *   data: {
 *     id, cpid, cpsn, connector, 
 *     guns_status, acdc, max_kw, 
 *     guns_memo1, transactionid, 
 *     createdAt, updatedAt,
 *     transaction?: {
 *       // 充電交易資訊
 *       id, transaction_id, start_time, end_time,
 *       energy_consumed, current_power, current_voltage,
 *       current_current, status, ...
 *     },
 *     realtime_cost?: {
 *       // 實時費用資訊（僅在充電中時返回）
 *       tariff_id, tariff_name, tariff_type,
 *       energy_consumed, applied_price, energy_fee,
 *       discount_amount, estimated_total, currency,
 *       billing_details: {
 *         rateType, calculation, timeFrame?, ...
 *       },
 *       calculation_time
 *     }
 *   } | Array,
 *   count?: number 
 * }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API /api/guns/status] 查詢充電樁狀態請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    const id = searchParams.get('id');
    
    // 如果有提供 id，直接查詢單一充電樁
    if (id) {
      const numericId = Number(id);
      const gun = await databaseService.getGunById(isNaN(numericId) ? id : numericId);
      
      if (!gun) {
        console.log(`❌ [API /api/guns/status] Gun not found for id: ${id}`);
        return NextResponse.json(
          { success: false, error: '充電樁不存在' },
          { status: 404 }
        );
      }
      
      // 返回單一充電樁狀態（使用 id 查詢時不附加 transaction）
      const statusData = {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        guns_status: gun.guns_status,
        acdc: gun.acdc,
        max_kw: gun.max_kw,
        guns_memo1: gun.guns_memo1,
        transactionid: gun.transactionid,
        createdAt: gun.createdAt,
        updatedAt: gun.updatedAt
      };
      
      console.log(`✅ [API /api/guns/status] Found gun: ${gun.cpsn}, status: ${gun.guns_status}`);
      
      return NextResponse.json({
        success: true,
        data: statusData
      });
    }
    
    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    
    if (cpid) {
      filter.cpid = cpid;
      console.log(`🔍 [API /api/guns/status] Filtering by cpid: ${cpid}`);
    }
    
    if (cpsn) {
      filter.cpsn = cpsn;
      console.log(`🔍 [API /api/guns/status] Filtering by cpsn: ${cpsn}`);
    }
    
    // 查詢充電樁資料
    const guns = await databaseService.getGuns(filter);
    
    console.log(`✅ [API /api/guns/status] Found ${guns.length} guns`);
    
    // 轉換資料格式，只返回狀態相關的欄位，並附加 transaction 資料（如果有）
    const statusData = await Promise.all(
      guns.map((gun: any) => attachTransactionToGun(gun))
    );
    
    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件
    if ((cpid || cpsn) && statusData.length === 1) {
      console.log(`✅ [API /api/guns/status] Returning single gun`);
      return NextResponse.json({
        success: true,
        data: statusData[0]
      });
    }
    
    // 返回陣列格式
    return NextResponse.json({
      success: true,
      data: statusData,
      count: statusData.length
    });
    
  } catch (error) {
    console.error('[API /api/guns/status] 錯誤:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢充電樁狀態失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/guns/status - 查詢充電樁狀態 (支援 POST 請求)
 * 
 * 支援與 GET 相同的查詢方式：
 * - Query 參數：?cpid=xxx, ?cpsn=xxx, ?id=xxx
 * - Request Body (JSON)：{ cpid: "xxx", cpsn: "xxx", id: "xxx" }
 * 
 * Body 參數優先於 Query 參數
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [API /api/guns/status POST] 查詢充電樁狀態請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    let cpid = searchParams.get('cpid');
    let cpsn = searchParams.get('cpsn');
    let id = searchParams.get('id');
    
    // 嘗試解析 request body (優先使用 body)
    try {
      const body = await request.json();
      if (body) {
        cpid = body.cpid || cpid;
        cpsn = body.cpsn || cpsn;
        id = body.id || id;
      }
    } catch (err) {
      // Body 不是 JSON 或為空，使用 query 參數
      console.log('🔍 [API /api/guns/status POST] 使用 query 參數');
    }
    
    // 如果有提供 id，直接查詢單一充電樁
    if (id) {
      const numericId = Number(id);
      const gun = await databaseService.getGunById(isNaN(numericId) ? id : numericId);
      
      if (!gun) {
        console.log(`❌ [API /api/guns/status POST] Gun not found for id: ${id}`);
        return NextResponse.json(
          { success: false, error: '充電樁不存在' },
          { status: 404 }
        );
      }
      
      // 返回單一充電樁狀態（使用 id 查詢時不附加 transaction）
      const statusData = {
        id: gun.id,
        cpid: gun.cpid,
        cpsn: gun.cpsn,
        connector: gun.connector,
        guns_status: gun.guns_status,
        acdc: gun.acdc,
        max_kw: gun.max_kw,
        guns_memo1: gun.guns_memo1,
        transactionid: gun.transactionid,
        createdAt: gun.createdAt,
        updatedAt: gun.updatedAt
      };
      
      console.log(`✅ [API /api/guns/status POST] Found gun: ${gun.cpsn}, status: ${gun.guns_status}`);
      
      return NextResponse.json({
        success: true,
        data: statusData
      });
    }
    
    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    
    if (cpid) {
      filter.cpid = cpid;
      console.log(`🔍 [API /api/guns/status POST] Filtering by cpid: ${cpid}`);
    }
    
    if (cpsn) {
      filter.cpsn = cpsn;
      console.log(`🔍 [API /api/guns/status POST] Filtering by cpsn: ${cpsn}`);
    }
    
    // 查詢充電樁資料
    const guns = await databaseService.getGuns(filter);
    
    console.log(`✅ [API /api/guns/status POST] Found ${guns.length} guns`);
    
    // 轉換資料格式，只返回狀態相關的欄位，並附加 transaction 資料（如果有）
    const statusData = await Promise.all(
      guns.map((gun: any) => attachTransactionToGun(gun))
    );
    
    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件
    if ((cpid || cpsn) && statusData.length === 1) {
      console.log(`✅ [API /api/guns/status POST] Returning single gun`);
      return NextResponse.json({
        success: true,
        data: statusData[0]
      });
    }
    
    // 返回陣列格式
    return NextResponse.json({
      success: true,
      data: statusData,
      count: statusData.length
    });
    
  } catch (error) {
    console.error('[API /api/guns/status POST] 錯誤:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢充電樁狀態失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
