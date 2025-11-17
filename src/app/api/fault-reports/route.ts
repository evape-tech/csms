import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '../../../lib/database/adapter.js';
import DatabaseUtils from '../../../lib/database/utils.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// GET - 取得故障報告列表
export async function GET(request: NextRequest) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const cpid = searchParams.get('cpid');
    const severity = searchParams.get('severity');
    const fault_type = searchParams.get('fault_type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // 建立過濾條件
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (cpid) {
      where.cpid = {
        contains: cpid
      };
    }
    
    if (severity) {
      where.severity = severity;
    }

    if (fault_type) {
      where.fault_type = fault_type;
    }
    
    if (startDate || endDate) {
      where.reported_at = {};
      if (startDate) {
        where.reported_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.reported_at.lte = new Date(endDate);
      }
    }

    // 取得資料和總數
    const [faultReports, totalCount] = await Promise.all([
      client.fault_reports.findMany({
        where,
        include: {
          users_fault_reports_user_idTousers: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          users_fault_reports_assigned_toTousers: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          reported_at: 'desc'
        },
        skip,
        take: limit
      }),
      client.fault_reports.count({ where })
    ]);

    // 統計資料
    const stats = await client.fault_reports.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    const statusStats = stats.reduce((acc: Record<string, number>, stat: any) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        reports: faultReports,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        stats: {
          total: totalCount,
          open: (statusStats.REPORTED || 0) + (statusStats.UNDER_REVIEW || 0),
          in_progress: statusStats.IN_PROGRESS || 0,
          resolved: statusStats.RESOLVED || 0,
          closed: statusStats.CLOSED || 0,
          critical: faultReports.filter((r: any) => r.severity === 'CRITICAL').length
        }
      }
    });

  } catch (error) {
    console.error('Get fault reports error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '取得故障報告失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST - 建立新的故障報告
export async function POST(request: NextRequest) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const body = await request.json();
    const {
      cpid,
      cpsn,
      connector_id,
      fault_type,
      severity = 'MEDIUM',
      description,
      user_id,
      reporter_user_id,
      assigned_to,
      assigned_technician_id,
      resolution
    } = body;

    // 驗證必要欄位
    const reporterId = user_id ?? reporter_user_id;
    const assigneeId = assigned_to ?? assigned_technician_id ?? null;
    const connectorId = typeof connector_id === 'number'
      ? connector_id
      : connector_id !== undefined && connector_id !== null
        ? Number(connector_id)
        : null;

    const normalizedConnectorId = connectorId !== null && Number.isNaN(connectorId)
      ? null
      : connectorId;

    if (!cpid || !fault_type || !description || !reporterId) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少必要欄位: cpid, fault_type, description, user_id' 
        },
        { status: 400 }
      );
    }

    // 建立故障報告
    const faultReport = await client.fault_reports.create({
      data: {
        cpid,
        cpsn,
        connector_id: normalizedConnectorId,
        fault_type,
        severity,
        description,
        user_id: String(reporterId),
        assigned_to: assigneeId ? String(assigneeId) : null,
        resolution: resolution ?? null,
        status: 'REPORTED',
        reported_at: new Date()
      },
      include: {
        users_fault_reports_user_idTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        users_fault_reports_assigned_toTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: faultReport,
      message: '故障報告建立成功'
    });

  } catch (error) {
    console.error('Create fault report error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '建立故障報告失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}