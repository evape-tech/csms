import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 驗證管理員權限
    let currentUser;
    try {
      currentUser = await AuthUtils.getCurrentUser(request);
    } catch (error) {
      throw error;
    }

    if (!currentUser || !AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ 
        error: '未授權訪問', 
        code: 'AUTHENTICATION_REQUIRED',
        message: '請重新登入以獲取有效的認證憑證'
      }, { status: 401 });
    }

    const { id: userId } = await params;
    
    if (!userId) {
      return NextResponse.json({ 
        error: '缺少用戶 ID' 
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type') || 'all'; // 'wallet', 'charging', 'all'

    const db = getDatabaseClient();
    const allTransactions: Array<Record<string, unknown>> = [];

    // 獲取錢包交易記錄
    if (type === 'wallet' || type === 'all') {
      const walletTransactionsResult = await db.$queryRaw`
        SELECT 
          'wallet' as source_type,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          payment_method,
          description,
          status,
          createdAt
        FROM wallet_transactions 
        WHERE user_id = ${userId}
        ORDER BY createdAt DESC
      `;

      if (Array.isArray(walletTransactionsResult)) {
        const walletTransactions = walletTransactionsResult.map((tx: Record<string, unknown>) => ({
          source_type: 'wallet',
          type: (tx.transaction_type as string)?.toLowerCase() === 'deposit' ? 'topup' : 'deduct',
          amount: Number(tx.amount),
          balance_before: Number(tx.balance_before),
          balance_after: Number(tx.balance_after),
          payment_method: tx.payment_method,
          note: tx.description,
          reason: tx.description,
          status: tx.status,
          created_at: tx.createdAt,
          admin_name: 'Admin'
        }));
        allTransactions.push(...walletTransactions);
      }
    }

    // 獲取充電交易記錄
    if (type === 'charging' || type === 'all') {
      const chargingTransactionsResult = await db.$queryRaw`
        SELECT 
          'charging' as source_type,
          transaction_id,
          energy_consumed,
          status,
          start_time,
          end_time,
          cpid,
          connector_id
        FROM charging_transactions 
        WHERE user_id = ${userId}
        ORDER BY start_time DESC
      `;

      if (Array.isArray(chargingTransactionsResult)) {
        const chargingTransactions = chargingTransactionsResult.map((tx: Record<string, unknown>) => ({
          source_type: 'charging',
          type: 'charging',
          amount: Number(tx.energy_consumed || 0),
          note: `充電交易 - ${(tx.cpid as string) || '未知充電站'}`,
          reason: `交易ID: ${tx.transaction_id}`,
          status: tx.status,
          created_at: tx.start_time,
          admin_name: 'System'
        }));
        allTransactions.push(...chargingTransactions);
      }
    }

    // 排序並分頁
    allTransactions.sort((a, b) => {
      const timeA = new Date(a.created_at as string | number | Date).getTime();
      const timeB = new Date(b.created_at as string | number | Date).getTime();
      return timeB - timeA;
    });
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);

    return NextResponse.json({
      transactions: paginatedTransactions,
      total: allTransactions.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('獲取交易記錄錯誤:', error);
    return NextResponse.json({ 
      error: '獲取交易記錄失敗' 
    }, { status: 500 });
  }
}
