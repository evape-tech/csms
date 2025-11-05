import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '@/lib/database/utils.js';
import { getDatabaseClient } from '@/lib/database/adapter.js';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  const charger = searchParams.get('charger');

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

  // 🔹 Charger (cpid / cpsn) 過濾
  if (charger) {
    const chargerList = charger.split(',').map(v => v.trim()).filter(Boolean);
    if (chargerList.length > 0) {
      where.OR = [
        ...(where.OR || []),
        { cpid: { in: chargerList } },
        { cpsn: { in: chargerList } }
      ];
    }
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

    const client = getDatabaseClient() as any;
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

    const formattedRecords = records.map((record: any) => {
      const startTime = record.start_time ? new Date(record.start_time) : null;
      const endTime = record.end_time ? new Date(record.end_time) : null;
      // charging_duration is stored in seconds across the server (see ocppMessageService)
      // We want to display minutes in the UI. Convert seconds -> minutes when appropriate.
      const durationFromFieldSeconds = record.charging_duration ?? 0;
      const fallbackDurationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : undefined;

      let minutes = 0;

      // If the DB field looks like a reasonable seconds value, convert to minutes
      if (durationFromFieldSeconds && durationFromFieldSeconds > 0) {
        // protect against accidentally-stored minutes (very large values would indicate minutes already)
        // assume values >= 10000 are already minutes (legacy) — keep previous heuristic
        if (durationFromFieldSeconds < 10000) {
          minutes = Math.round(durationFromFieldSeconds / 60);
        } else {
          minutes = Math.round(durationFromFieldSeconds);
        }
      } else if (fallbackDurationMs) {
        minutes = Math.round(fallbackDurationMs / 60000);
      }

      return {
        id: record.id.toString(),
        user: formatUserName(record.users ?? undefined),
        charger: record.cpid || record.cpsn || '-',
        date: startTime?.toISOString() ?? null,
        duration: formatDuration(minutes, fallbackDurationMs),
        kWh: decimalToNumber(record.energy_consumed)
      };
    });

    // Export as Excel if requested
    const format = (searchParams.get('format') || '').toLowerCase();
    if (format === 'xlsx') {
      const exportLimit = Math.min(
        Math.max(parseInt(searchParams.get('exportLimit') || '5000', 10), 1),
        20000
      );
      const exportRecords = await client.charging_transactions.findMany({
        where,
        include: {
          users: {
            select: { first_name: true, last_name: true, email: true }
          }
        },
        orderBy: { start_time: 'desc' },
        take: exportLimit
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('使用記錄');
      sheet.columns = [
        { header: '用戶', key: 'user', width: 22 },
        { header: '充電樁', key: 'charger', width: 16 },
        { header: '日期', key: 'date', width: 14 },
        { header: '使用時間', key: 'duration', width: 14 },
        { header: '電量 (kWh)', key: 'kWh', width: 14 }
      ];

      for (const r of exportRecords) {
        const startTime = r.start_time ? new Date(r.start_time) : null;
        const endTime = r.end_time ? new Date(r.end_time) : null;
        const durationFromFieldSeconds = r.charging_duration ?? 0;
        const fallbackDurationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : undefined;
        let minutes = 0;
        if (durationFromFieldSeconds && durationFromFieldSeconds > 0) {
          if (durationFromFieldSeconds < 10000) {
            minutes = Math.round(durationFromFieldSeconds / 60);
          } else {
            minutes = Math.round(durationFromFieldSeconds);
          }
        } else if (fallbackDurationMs) {
          minutes = Math.round(fallbackDurationMs / 60000);
        }

        sheet.addRow({
          user: r.users ? `${r.users.first_name ?? ''}${r.users.last_name ?? ''}`.trim() || r.users.email || '未提供' : '未提供',
          charger: r.cpid || r.cpsn || '-',
          date: startTime ? startTime.toISOString().split('T')[0] : '',
          duration: minutes > 0 ? `${minutes}分鐘` : '—',
          kWh: Number((Number(r.energy_consumed ?? 0)).toFixed(3))
        });
      }
      sheet.getRow(1).font = { bold: true };

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const nodeBuffer = Buffer.from(new Uint8Array(arrayBuffer));
      const start = searchParams.get('startDate') || '';
      const end = searchParams.get('endDate') || '';
      const fileName = `usage_${start}_${end}.xlsx`;

      return new NextResponse(nodeBuffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
          'Content-Length': String(nodeBuffer.byteLength),
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

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
