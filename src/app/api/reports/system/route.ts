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
  const actionTypeMap: Record<string, string> = {
    '建立': 'CREATE',
    '更新': 'UPDATE',
    '刪除': 'DELETE',
    '登入': 'LOGIN',
    '登出': 'LOGOUT',
    '匯出': 'EXPORT',
    '匯入': 'IMPORT',
    '核准': 'APPROVE',
    '駁回': 'REJECT',
    '重置': 'RESET'
  };
  const statusMap: Record<string, string> = {
    '成功': 'SUCCESS',
    '失敗': 'FAILED'
  };

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
    where.action_type = actionTypeMap[actionType] ?? actionType;
  }

  if (entityType) {
    where.entity_type = entityType;
  }

  if (status) {
    where.status = statusMap[status] ?? status;
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

    const client = getDatabaseClient() as any;
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

    const formattedRecords = records.map((record: any) => ({
      id: record.id.toString(),
      time: record.createdAt?.toISOString() ?? null,
      type: actionTypeLabels[record.action_type] ?? record.action_type,
      description: record.description ?? '-',
      status: statusLabels[record.status] ?? record.status
    }));

    // Export as Excel if requested
    const format = (searchParams.get('format') || '').toLowerCase();
    if (format === 'xlsx') {
      const exportLimit = Math.min(
        Math.max(parseInt(searchParams.get('exportLimit') || '5000', 10), 1),
        20000
      );
      const exportRecords = await client.operation_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: exportLimit
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('系統記錄');
      sheet.columns = [
        { header: '時間', key: 'time', width: 22 },
        { header: '類型', key: 'type', width: 14 },
        { header: '描述', key: 'description', width: 40 },
        { header: '狀態', key: 'status', width: 12 }
      ];

      for (const r of exportRecords) {
        sheet.addRow({
          time: r.createdAt ? new Date(r.createdAt).toISOString() : '',
          type: actionTypeLabels[r.action_type] ?? r.action_type,
          description: r.description ?? '-',
          status: statusLabels[r.status] ?? r.status
        });
      }
      sheet.getRow(1).font = { bold: true };

      const arrayBuffer = await workbook.xlsx.writeBuffer();
      const nodeBuffer = Buffer.from(new Uint8Array(arrayBuffer));
      const start = searchParams.get('startDate') || '';
      const end = searchParams.get('endDate') || '';
      const fileName = `system_${start}_${end}.xlsx`;

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
