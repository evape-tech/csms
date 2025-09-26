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

const decimalToNumber = (value: any, fractionDigits = 3) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Number(parsed.toFixed(fractionDigits));
};

const formatUserName = (user?: { first_name?: string | null; last_name?: string | null; email?: string | null; }) => {
  const firstName = user?.first_name?.trim();
  const lastName = user?.last_name?.trim();

  if (firstName || lastName) {
    return `${firstName ?? ''}${lastName ?? ''}`.trim();
  }

  return user?.email ?? '未提供';
};

const formatDuration = (durationMinutes: number, fallbackMs?: number) => {
  let totalMinutes = durationMinutes;

  if (!totalMinutes && fallbackMs) {
    totalMinutes = Math.round(fallbackMs / 60000);
  }

  if (!totalMinutes || totalMinutes <= 0) {
    return '—';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}小時${minutes > 0 ? ` ${minutes}分鐘` : ''}`.trim();
  }

  return `${minutes}分鐘`;
};

const buildWhereClause = (searchParams: URLSearchParams) => {
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'), true);
  const search = searchParams.get('search');
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');

  const where: Record<string, any> = {};

  if (startDate || endDate) {
    where.start_time = {};
    if (startDate) {
      where.start_time.gte = startDate;
    }
    if (endDate) {
      where.start_time.lte = endDate;
    }
  }

  if (userId) {
    where.user_id = userId;
  }

  if (status) {
    where.status = status;
  }

  const orConditions: any[] = [];

  if (search) {
    orConditions.push(
      { transaction_id: { contains: search, mode: 'insensitive' } },
      { cpid: { contains: search, mode: 'insensitive' } },
      { cpsn: { contains: search, mode: 'insensitive' } },
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
      client.charging_transactions.findMany({
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
          start_time: 'desc'
        },
        skip,
        take: limit
      }),
      client.charging_transactions.count({ where }),
      client.charging_transactions.aggregate({
        where,
        _sum: {
          energy_consumed: true
        }
      })
    ]);

    const formattedRecords = records.map((record) => {
      const startTime = record.start_time ? new Date(record.start_time) : null;
      const endTime = record.end_time ? new Date(record.end_time) : null;
      const durationFromField = record.charging_duration ?? 0;
      const fallbackDuration = startTime && endTime ? endTime.getTime() - startTime.getTime() : undefined;

      const minutes = durationFromField > 0 && durationFromField < 10000
        ? durationFromField
        : fallbackDuration
          ? Math.round(fallbackDuration / 60000)
          : 0;

      return {
        id: record.id.toString(),
        user: formatUserName(record.users ?? undefined),
        charger: record.cpid || record.cpsn || '-',
        date: startTime?.toISOString() ?? null,
        duration: formatDuration(minutes, fallbackDuration),
        kWh: decimalToNumber(record.energy_consumed)
      };
    });

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
          totalEnergy: decimalToNumber(aggregates._sum.energy_consumed)
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/reports/usage] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: '取得使用紀錄失敗',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
