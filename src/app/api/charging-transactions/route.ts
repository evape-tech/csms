import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../lib/auth/authHelper';
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseService } from '../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * Get all charging transactions
 * 
 * @route GET /api/charging-transactions
 * @auth Bearer Token or Cookie
 * @query status - Filter by transaction status (ACTIVE | COMPLETED | STOPPED | ERROR | CANCELLED)
 * @query user_id - Filter by user UUID
 * @query cpid - Filter by charge point ID
 * @query cpsn - Filter by charge point serial number
 * @query start_date - Start date filter (ISO 8601)
 * @query end_date - End date filter (ISO 8601)
 * @query limit - Number of results per page (default: 50, max: 500)
 * @query offset - Offset for pagination (default: 0)
 * 
 * @returns { success: boolean, transactions: [...], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // 解析查詢參數
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    console.log(`🔍 [API /api/charging-transactions] 查詢充電交易記錄`);

    // 構建查詢條件
    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (userId) {
      where.user_id = userId;
    }

    if (cpid) {
      where.cpid = cpid;
    }

    if (cpsn) {
      where.cpsn = cpsn;
    }

    // 時間範圍查詢
    if (startDate || endDate) {
      const gte = startDate ? new Date(`${startDate}T00:00:00`) : undefined;
      const lte = endDate ? new Date(`${endDate}T23:59:59`) : undefined;
      where.start_time = {};
      if (gte) where.start_time.gte = gte;
      if (lte) where.start_time.lte = lte;
      console.log("🕒 篩選時間範圍 =>", {
  startDate, endDate,
  gte: gte?.toISOString(),
  lte: lte?.toISOString(),
});
    }

    console.log("🧩 where 條件:", where);
    
    // 獲取所有交易
    const transactions = await databaseService.getTransactions(where);
    console.log("✅ 查得筆數:", transactions.length);

    // 獲取總數
    const total = transactions.length;

    // 手動分頁
    //const paginatedTransactions = transactions.slice(offset, offset + limit);
    const paginatedTransactions = transactions;

    // 格式化返回資料
    const formattedTransactions = paginatedTransactions.map((tx: any) => ({
      id: Number(tx.id),
      transaction_id: tx.transaction_id,
      start_time: tx.start_time,
      end_time: tx.end_time,
      cpid: tx.cpid,
      cpsn: tx.cpsn,
      connector_id: tx.connector_id,
      user_id: tx.user_id,
      id_tag: tx.id_tag,
      meter_start: tx.meter_start ? Number(tx.meter_start) : null,
      meter_stop: tx.meter_stop ? Number(tx.meter_stop) : null,
      energy_consumed: tx.energy_consumed ? Number(tx.energy_consumed) : null,
      current_power: tx.current_power ? Number(tx.current_power) : null,
      current_voltage: tx.current_voltage ? Number(tx.current_voltage) : null,
      current_current: tx.current_current ? Number(tx.current_current) : null,
      charging_duration: tx.charging_duration,
      status: tx.status,
      stop_reason: tx.stop_reason,
      last_meter_update: tx.last_meter_update,
      created_at: tx.createdAt,
      updated_at: tx.updatedAt
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      total,
      limit,
      offset,
      returned: formattedTransactions.length
    });

  } catch (error) {
    console.error('[API /api/charging-transactions] error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '取得充電交易記錄失敗' 
      },
      { status: 500 }
    );
  }
}

/**
 * Create a new charging transaction
 * 
 * @route POST /api/charging-transactions
 * @auth Bearer Token or Cookie
 * @body { transaction_id, start_time, cpid, cpsn, connector_id, user_id, id_tag, meter_start?, status? }
 * 
 * @returns { success: boolean, transaction: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      transaction_id, 
      start_time, 
      cpid, 
      cpsn, 
      connector_id, 
      user_id, 
      id_tag,
      meter_start,
      status = 'ACTIVE'
    } = body;

    // 驗證必填欄位
    if (!transaction_id || !start_time || !cpid || !cpsn || !connector_id || !user_id || !id_tag) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填欄位: transaction_id, start_time, cpid, cpsn, connector_id, user_id, id_tag'
        },
        { status: 400 }
      );
    }

    console.log(`📝 [API /api/charging-transactions] 建立新的充電交易記錄: ${transaction_id}`);

    // 建立交易記錄
    const transaction = await databaseService.createTransaction({
      transaction_id,
      start_time: new Date(start_time),
      cpid,
      cpsn,
      connector_id,
      user_id,
      id_tag,
      meter_start: meter_start ? parseFloat(meter_start) : null,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 格式化返回資料
    const formattedTransaction = {
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
      charging_duration: transaction.charging_duration,
      status: transaction.status,
      stop_reason: transaction.stop_reason,
      last_meter_update: transaction.last_meter_update,
      created_at: transaction.createdAt,
      updated_at: transaction.updatedAt
    };

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
      message: '成功建立充電交易記錄'
    }, { status: 201 });

  } catch (error) {
    console.error('[API /api/charging-transactions] error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '建立充電交易記錄失敗',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

