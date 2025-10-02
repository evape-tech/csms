import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '../../../lib/database/adapter.js';
import DatabaseUtils from '../../../lib/database/utils.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

const serializePrismaData = (input: any): any => {
  if (input === null || input === undefined) return input;
  if (typeof input === 'bigint') return input.toString();
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.map(serializePrismaData);
  if (typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      out[key] = serializePrismaData(value);
    }
    return out;
  }
  return input;
};

// GET - 取得維護記錄列表
export async function GET(request: NextRequest) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const maintenance_type = searchParams.get('maintenance_type');
    const cpid = searchParams.get('cpid');
    const priority = searchParams.get('priority');
    const technician_id = searchParams.get('technician_id');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // 建立過濾條件
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (maintenance_type) {
      where.maintenance_type = maintenance_type;
    }
    
    if (cpid) {
      where.cpid = {
        contains: cpid
      };
    }
    
    if (priority) {
      where.priority = priority;
    }
    
    if (technician_id) {
      where.technician_id = parseInt(technician_id);
    }
    
    if (startDate || endDate) {
      where.scheduled_date = {};
      if (startDate) {
        where.scheduled_date.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduled_date.lte = new Date(endDate);
      }
    }

    // 取得資料和總數
    const [maintenanceRecords, totalCount] = await Promise.all([
      client.maintenance_records.findMany({
        where,
        include: {
          users_maintenance_records_created_byTousers: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          users_maintenance_records_technician_idTousers: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: {
          scheduled_date: 'desc'
        },
        skip,
        take: limit
      }),
      client.maintenance_records.count({ where })
    ]);

    // 統計資料
    const stats = await client.maintenance_records.groupBy({
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
        records: serializePrismaData(maintenanceRecords),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        stats: {
          total: totalCount,
          scheduled: statusStats.SCHEDULED || 0,
          in_progress: statusStats.IN_PROGRESS || 0,
          completed: statusStats.COMPLETED || 0,
          cancelled: statusStats.CANCELLED || 0,
          failed: statusStats.FAILED || 0
        }
      }
    });

  } catch (error) {
    console.error('Get maintenance records error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '取得維護記錄失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST - 建立新的維護記錄
export async function POST(request: NextRequest) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    const body = await request.json();
    const {
      cpid,
      cpsn,
      maintenance_type,
      priority = 'NORMAL',
      description,
      scheduled_date,
      technician_id,
      technician_name,
      created_by
    } = body;

    // 驗證必要欄位
    if (!cpid || !maintenance_type || !description) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少必要欄位: cpid, maintenance_type, description' 
        },
        { status: 400 }
      );
    }

    // 建立維護記錄
    const maintenanceRecord = await client.maintenance_records.create({
      data: {
        cpid,
        cpsn,
        maintenance_type,
        priority,
        description,
        scheduled_date: scheduled_date ? new Date(scheduled_date) : null,
  technician_id: technician_id || null,
  technician_name,
  created_by: created_by || null,
        status: 'SCHEDULED'
      },
      include: {
        users_maintenance_records_created_byTousers: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        users_maintenance_records_technician_idTousers: {
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
      data: serializePrismaData(maintenanceRecord),
      message: '維護記錄建立成功'
    });

  } catch (error) {
    console.error('Create maintenance record error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '建立維護記錄失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}