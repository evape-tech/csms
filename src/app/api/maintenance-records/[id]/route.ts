import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '../../../../lib/database/adapter.js';
import DatabaseUtils from '../../../../lib/database/utils.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// GET - 取得單一維護記錄
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: '無效的維護記錄 ID' },
        { status: 400 }
      );
    }

    const maintenanceRecord = await prisma.maintenance_records.findUnique({
      where: { id },
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

    if (!maintenanceRecord) {
      return NextResponse.json(
        { success: false, message: '維護記錄不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: maintenanceRecord
    });

  } catch (error) {
    console.error('Get maintenance record error:', error);
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

// PUT - 更新維護記錄
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);
    const body = await request.json();
    const {
      status,
      technician_id,
      technician_name,
      parts_used,
      labor_cost,
      parts_cost,
      total_cost,
      result,
      next_maintenance_date,
      remarks,
      actual_start_date,
      actual_end_date
    } = body;

    // 檢查維護記錄是否存在
    const existingRecord = await prisma.maintenance_records.findUnique({
      where: { id }
    });

    if (!existingRecord) {
      return NextResponse.json(
        { success: false, message: '維護記錄不存在' },
        { status: 404 }
      );
    }

    // 準備更新資料
    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
    }
    
    if (technician_id !== undefined) {
      updateData.technician_id = technician_id;
    }
    
    if (technician_name !== undefined) {
      updateData.technician_name = technician_name;
    }
    
    if (parts_used !== undefined) {
      updateData.parts_used = parts_used;
    }
    
    if (labor_cost !== undefined) {
      updateData.labor_cost = parseFloat(labor_cost);
    }
    
    if (parts_cost !== undefined) {
      updateData.parts_cost = parseFloat(parts_cost);
    }
    
    if (total_cost !== undefined) {
      updateData.total_cost = parseFloat(total_cost);
    }
    
    if (result !== undefined) {
      updateData.result = result;
    }
    
    if (next_maintenance_date !== undefined) {
      updateData.next_maintenance_date = next_maintenance_date ? new Date(next_maintenance_date) : null;
    }
    
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }
    
    if (actual_start_date !== undefined) {
      updateData.actual_start_date = actual_start_date ? new Date(actual_start_date) : null;
    }
    
    if (actual_end_date !== undefined) {
      updateData.actual_end_date = actual_end_date ? new Date(actual_end_date) : null;
    }

    // 自動設定開始時間（如果狀態改為進行中且尚未設定）
    if (status === 'IN_PROGRESS' && !existingRecord.actual_start_date && !actual_start_date) {
      updateData.actual_start_date = new Date();
    }

    // 自動設定結束時間（如果狀態改為完成且尚未設定）
    if (status === 'COMPLETED' && !existingRecord.actual_end_date && !actual_end_date) {
      updateData.actual_end_date = new Date();
    }

    const updatedRecord = await prisma.maintenance_records.update({
      where: { id },
      data: updateData,
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
      data: updatedRecord,
      message: '維護記錄更新成功'
    });

  } catch (error) {
    console.error('Update maintenance record error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '更新維護記錄失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE - 刪除維護記錄
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);

    // 檢查維護記錄是否存在
    const existingRecord = await prisma.maintenance_records.findUnique({
      where: { id }
    });

    if (!existingRecord) {
      return NextResponse.json(
        { success: false, message: '維護記錄不存在' },
        { status: 404 }
      );
    }

    await prisma.maintenance_records.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '維護記錄刪除成功'
    });

  } catch (error) {
    console.error('Delete maintenance record error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '刪除維護記錄失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}