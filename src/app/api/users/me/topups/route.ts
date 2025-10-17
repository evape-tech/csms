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

    const db = getDatabaseClient();

    // 先取得總數
    const countResult = await db.$queryRaw`
      SELECT COUNT(*) as total
      FROM wallet_transactions
      WHERE user_id = ${currentUser.userId} AND transaction_type = 'DEPOSIT'
    `;
    const totalCount = Array.isArray(countResult) && countResult.length > 0 
      ? Number((countResult[0] as any).total) 
      : 0;

    // 取得分頁資料
    const topupsResult = await db.$queryRaw`
      SELECT id, transaction_type, amount, balance_before, balance_after, payment_method, description, status, createdAt
      FROM wallet_transactions
      WHERE user_id = ${currentUser.userId} AND transaction_type = 'DEPOSIT'
      ORDER BY createdAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const topups = Array.isArray(topupsResult) ? topupsResult.map((tx: any) => ({
      id: Number(tx.id),
      amount: Number(tx.amount),
      balance_before: Number(tx.balance_before),
      balance_after: Number(tx.balance_after),
      payment_method: tx.payment_method,
      note: tx.description,
      status: tx.status,
      created_at: tx.createdAt
    })) : [];

    return NextResponse.json({ success: true, topups, total: totalCount, limit, offset });
  } catch (error) {
    console.error('[API /api/users/me/topups] error:', error);
    return NextResponse.json({ error: '取得充值紀錄失敗' }, { status: 500 });
  }
}
