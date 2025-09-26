import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '@/lib/database/utils.js';
import { getDatabaseClient } from '@/lib/database/adapter.js';

export const dynamic = 'force-dynamic';

const parseDate = (value: string | null, isEnd = false) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
};

const decimalToNumber = (value: any) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatUserName = (user?: { first_name?: string | null; last_name?: string | null; email?: string | null; }) => {
  const firstName = user?.first_name?.trim();
  const lastName = user?.last_name?.trim();

  if (firstName || lastName) {
    return `${firstName ?? ''}${lastName ?? ''}`.trim();
  }

  return user?.email ?? '未提供';
};

const typeLabels: Record<string, string> = {
  DEPOSIT: '儲值',
  WITHDRAWAL: '提領',
  PAYMENT: '扣款',
  REFUND: '退款',
  ADJUSTMENT: '調整'
};

const statusLabels: Record<string, string> = {
  PENDING: '待處理',
  COMPLETED: '成功',
  FAILED: '失敗',
  CANCELLED: '取消'
};

const buildWhereClause = (searchParams: URLSearchParams) => {
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'), true);
  const search = searchParams.get('search');
  const userId = searchParams.get('userId');
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  const where: Record<string, any> = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  if (userId) {
    where.user_id = userId;
  }

  if (type) {
    where.transaction_type = type;
  }

  if (status) {
    where.status = status;
  }

  const orConditions: any[] = [];

  if (search) {
    orConditions.push(
      { description: { contains: search, mode: 'insensitive' } },
      {
        users: {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      }
    );
  }

  if (orConditions.length > 0) {
    where.OR = orConditions;
  }

  return where;
};

export async function GET(request: NextRequest) {
  try {
    const initialized = await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    if (!initialized) {
      return NextResponse.json(
        {
          success: false,
          message: '資料庫初始化失敗'
        },
        { status: 500 }
      );
    }

    const client = getDatabaseClient();
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);
    const skip = (page - 1) * limit;

    const where = buildWhereClause(searchParams);

    const [records, totalCount, aggregates] = await Promise.all([
      client.wallet_transactions.findMany({
        where,
        include: {
          users: {
            select: {
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      client.wallet_transactions.count({ where }),
      client.wallet_transactions.aggregate({
        where,
        _sum: {
          amount: true
        }
      })
    ]);

    const formattedRecords = records.map((record) => ({
      id: record.id.toString(),
      user: formatUserName(record.users ?? undefined),
      time: record.createdAt?.toISOString() ?? null,
      type: typeLabels[record.transaction_type] ?? record.transaction_type,
      amount: decimalToNumber(record.amount),
      balance: decimalToNumber(record.balance_after),
      status: statusLabels[record.status] ?? record.status
    }));

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return NextResponse.json({
      success: true,
      data: {
        records: formattedRecords,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages
        },
        summary: {
          totalAmount: decimalToNumber(aggregates._sum.amount)
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/reports/transactions] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: '取得交易紀錄失敗',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
