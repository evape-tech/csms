import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../lib/database/utils.js';
import { getDatabaseClient } from '../../../../../lib/database/adapter';

export const dynamic = 'force-dynamic';

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

    const db = getDatabaseClient();

    let totalCount = 0;
    const results: any[] = [];

    // wallet transactions
    if (type === 'wallet' || type === 'all') {
      // 取得 wallet 總數
      const walletCountResult = await db.$queryRaw`
        SELECT COUNT(*) as total
        FROM wallet_transactions
        WHERE user_id = ${currentUser.userId}
      `;
      const walletCount = Array.isArray(walletCountResult) && walletCountResult.length > 0
        ? Number((walletCountResult[0] as any).total)
        : 0;
      totalCount += walletCount;

      // 取得 wallet 交易（不在這裡分頁，稍後合併排序後再分頁）
      const walletTransactionsResult = await db.$queryRaw`
        SELECT id, transaction_type, amount, balance_before, balance_after, payment_method, description, status, createdAt
        FROM wallet_transactions
        WHERE user_id = ${currentUser.userId}
        ORDER BY createdAt DESC
      `;

      if (Array.isArray(walletTransactionsResult)) {
        results.push(...walletTransactionsResult.map((tx: any) => ({
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
    }

    // charging transactions
    if (type === 'charging' || type === 'all') {
      // 取得 charging 總數
      const chargingCountResult = await db.$queryRaw`
        SELECT COUNT(*) as total
        FROM charging_transactions
        WHERE user_id = ${currentUser.userId}
      `;
      const chargingCount = Array.isArray(chargingCountResult) && chargingCountResult.length > 0
        ? Number((chargingCountResult[0] as any).total)
        : 0;
      totalCount += chargingCount;

      // 取得 charging 交易
      const chargingTransactionsResult = await db.$queryRaw`
        SELECT id, transaction_id, energy_consumed, status, start_time, end_time, cpid, cpsn, connector_id, createdAt
        FROM charging_transactions
        WHERE user_id = ${currentUser.userId}
        ORDER BY start_time DESC
      `;

      if (Array.isArray(chargingTransactionsResult)) {
        results.push(...chargingTransactionsResult.map((tx: any) => ({
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
          created_at: tx.start_time || tx.createdAt
        })));
      }
    }

    // sort by created_at desc and paginate
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginated = results.slice(offset, offset + limit);

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
