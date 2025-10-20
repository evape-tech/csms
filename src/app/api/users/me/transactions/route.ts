import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 查詢使用者交易紀錄
 * 
 * @route GET /api/users/me/transactions
 * @auth Cookie 或 Bearer Token
 * @query type - 交易類型 (wallet | charging | all)，預設 all
 * @query status - 充電狀態過濾 (ACTIVE | COMPLETED | STOPPED | ERROR | CANCELLED)，多個用逗號分隔
 * @query mode - 查詢模式 (all | active | history)
 *               - all: 所有交易（預設）
 *               - active: 只查詢進行中的充電（status=ACTIVE）
 *               - history: 只查詢歷史充電（排除 ACTIVE）
 * @query limit - 每頁數量，預設 50，最大 500
 * @query offset - 偏移量，預設 0
 * @returns { success: boolean, transactions: [...], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登入或 token 無效' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const type = (searchParams.get('type') || 'all').toLowerCase(); // wallet | charging | all
    const mode = (searchParams.get('mode') || 'all').toLowerCase(); // all | active | history
    const statusParam = searchParams.get('status'); // 充電狀態過濾

    // 解析狀態參數
    const validStatuses = ['ACTIVE', 'COMPLETED', 'STOPPED', 'ERROR', 'CANCELLED'];
    let statusFilter: string[] | null = null;
    
    // mode 優先處理
    if (mode === 'active') {
      // active 模式：只查詢進行中的充電
      statusFilter = ['ACTIVE'];
    } else if (mode === 'history') {
      // history 模式：只查詢已完成的充電
      statusFilter = ['COMPLETED', 'STOPPED', 'ERROR', 'CANCELLED'];
    } else if (statusParam) {
      // 自訂狀態過濾
      const statuses = statusParam.toUpperCase().split(',').filter(s => validStatuses.includes(s.trim()));
      if (statuses.length > 0) {
        statusFilter = statuses;
      }
    }

    let totalCount = 0;
    const results: any[] = [];

    // wallet transactions (mode=active/history 時不查詢錢包交易)
    if ((type === 'wallet' || type === 'all') && mode === 'all') {
      const walletCount = await databaseService.countUserWalletTransactions(currentUser.userId);
      totalCount += walletCount;

      const walletTransactions = await databaseService.getUserWalletTransactions(currentUser.userId, 9999, 0);
      
      results.push(...walletTransactions.map((tx: any) => ({
        id: Number(tx.id),
        source: 'wallet',
        type: tx.transaction_type?.toLowerCase() === 'deposit' ? 'topup' : 'deduct',
        amount: Number(tx.amount),
        balance_before: Number(tx.balance_before),
        balance_after: Number(tx.balance_after),
        payment_method: tx.payment_method,
        note: tx.description,
        status: tx.status,
        created_at: tx.createdAt
      })));
    }

    // charging transactions
    if (type === 'charging' || type === 'all' || mode === 'active' || mode === 'history') {
      const chargingCount = await databaseService.countUserChargingTransactions(currentUser.userId);
      totalCount += chargingCount;

      const chargingTransactions = await databaseService.getUserChargingTransactions(currentUser.userId, 9999, 0);

      // 應用狀態過濾
      const filteredTransactions = statusFilter 
        ? chargingTransactions.filter((tx: any) => statusFilter.includes(tx.status))
        : chargingTransactions;

      results.push(...filteredTransactions.map((tx: any) => ({
        id: Number(tx.id),
        source: 'charging',
        type: 'charging',
        amount: Number(tx.energy_consumed || 0),
        note: `充電交易 - ${tx.cpid || tx.cpsn || '-'}`,
        status: tx.status,
        start_time: tx.start_time,
        end_time: tx.end_time,
        transaction_id: tx.transaction_id,
        cpid: tx.cpid,
        cpsn: tx.cpsn,
        connector_id: tx.connector_id,
        id_tag: tx.id_tag,
        meter_start: tx.meter_start ? Number(tx.meter_start) : null,
        meter_stop: tx.meter_stop ? Number(tx.meter_stop) : null,
        current_power: tx.current_power ? Number(tx.current_power) : null,
        current_voltage: tx.current_voltage ? Number(tx.current_voltage) : null,
        current_current: tx.current_current ? Number(tx.current_current) : null,
        charging_duration: tx.charging_duration,
        last_meter_update: tx.last_meter_update,
        stop_reason: tx.stop_reason,
        created_at: tx.start_time || tx.createdAt,
        updated_at: tx.updatedAt
      })));
    }

    // sort by created_at desc and paginate
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginated = results.slice(offset, offset + limit);

    // 特殊處理：active 模式且只有一筆或零筆資料時，返回特殊格式
    if (mode === 'active') {
      const activeCharging = paginated.length > 0 ? paginated[0] : null;
      
      // 如果有進行中的充電，計算實時充電時長
      if (activeCharging && activeCharging.start_time && !activeCharging.end_time) {
        const startTime = new Date(activeCharging.start_time);
        const now = new Date();
        activeCharging.charging_duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      }
      
      return NextResponse.json({ 
        success: true,
        hasActiveCharging: paginated.length > 0,
        activeCharging,
        message: paginated.length > 0 ? '充電進行中' : '目前沒有進行中的充電'
      });
    }

    return NextResponse.json({ 
      success: true, 
      transactions: paginated, 
      total: totalCount, 
      limit, 
      offset,
      returned: paginated.length
    });
  } catch (error) {
    console.error('[API /api/users/me/transactions] error:', error);
    return NextResponse.json({ error: '取得交易紀錄失敗' }, { status: 500 });
  }
}
