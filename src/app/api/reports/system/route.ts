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

const actionTypeLabels: Record<string, string> = {
  CREATE: '建立',
  UPDATE: '更新',
  DELETE: '刪除',
  LOGIN: '登入',
  LOGOUT: '登出',
  EXPORT: '匯出',
  IMPORT: '匯入',
  APPROVE: '核准',
  REJECT: '駁回',
  RESET: '重置'
};

const statusLabels: Record<string, string> = {
  SUCCESS: '成功',
  FAILED: '失敗'
};

const buildWhereClause = (searchParams: URLSearchParams) => {
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'), true);
  const search = searchParams.get('search');
  const actionType = searchParams.get('actionType');
  const entityType = searchParams.get('entityType');
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

  if (actionType) {
    where.action_type = actionType;
  }

  if (entityType) {
    where.entity_type = entityType;
  }

  if (status) {
    where.status = status;
  }

  const orConditions: any[] = [];

  if (search) {
    orConditions.push(
      { description: { contains: search, mode: 'insensitive' } },
      { entity_name: { contains: search, mode: 'insensitive' } },
      { user_email: { contains: search, mode: 'insensitive' } },
      { user_name: { contains: search, mode: 'insensitive' } }
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

    const [records, totalCount] = await Promise.all([
      client.operation_logs.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      client.operation_logs.count({ where })
    ]);

    const formattedRecords = records.map((record) => ({
      id: record.id.toString(),
      time: record.createdAt?.toISOString() ?? null,
      type: actionTypeLabels[record.action_type] ?? record.action_type,
      description: record.description ?? '-',
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
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/reports/system] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: '取得系統紀錄失敗',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
