import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '../../../../lib/database/adapter.js';
import DatabaseUtils from '../../../../lib/database/utils.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// GET - 取得單一故障報告
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    let id: bigint;
    try {
      id = BigInt(params.id);
    } catch {
      return NextResponse.json(
        { success: false, message: '無效的故障報告 ID' },
        { status: 400 }
      );
    }

    const faultReport = await client.fault_reports.findUnique({
      where: { id },
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

    if (!faultReport) {
      return NextResponse.json(
        { success: false, message: '故障報告不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: faultReport
    });

  } catch (error) {
    console.error('Get fault report error:', error);
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

// PUT - 更新故障報告
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    let id: bigint;
    try {
      id = BigInt(params.id);
    } catch {
      return NextResponse.json(
        { success: false, message: '無效的故障報告 ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      status,
      assigned_to,
      resolution,
      severity
    } = body;

    // 檢查故障報告是否存在
    const existingReport = await client.fault_reports.findUnique({
      where: { id }
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, message: '故障報告不存在' },
        { status: 404 }
      );
    }

    // 準備更新資料
    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
    }
    
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to ? String(assigned_to) : null;
    }
    
    if (resolution !== undefined) {
      updateData.resolution = resolution;
    }
    
    if (severity !== undefined) {
      updateData.severity = severity;
    }

    // 如果狀態改為已解決，設定解決時間
    if (status === 'RESOLVED' && !existingReport.resolved_at) {
      updateData.resolved_at = new Date();
    }

    const updatedReport = await client.fault_reports.update({
      where: { id },
      data: updateData,
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
      data: updatedReport,
      message: '故障報告更新成功'
    });

  } catch (error) {
    console.error('Update fault report error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '更新故障報告失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE - 刪除故障報告
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient();

    let id: bigint;
    try {
      id = BigInt(params.id);
    } catch {
      return NextResponse.json(
        { success: false, message: '無效的故障報告 ID' },
        { status: 400 }
      );
    }

    // 檢查故障報告是否存在
    const existingReport = await client.fault_reports.findUnique({
      where: { id }
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, message: '故障報告不存在' },
        { status: 404 }
      );
    }

    await client.fault_reports.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: '故障報告刪除成功'
    });

  } catch (error) {
    console.error('Delete fault report error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '刪除故障報告失敗', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}