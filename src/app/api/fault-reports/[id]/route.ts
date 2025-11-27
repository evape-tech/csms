import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '../../../../lib/database/adapter.js';
import DatabaseUtils from '../../../../lib/database/utils.js';

// BigInt 序列化工具
function serializeBigInt(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export const dynamic = 'force-dynamic';

/* ===========================
   GET 取得單一故障報告
=========================== */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const idParam = params.id;
    let id: bigint;

    try {
      id = BigInt(idParam);
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的故障報告 ID" },
        { status: 400 }
      );
    }

    const report = await client.fault_reports.findUnique({
      where: { id },
      include: {
        users_fault_reports_user_idTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        },
        users_fault_reports_assigned_toTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        }
      }
    });

    if (!report) {
      return NextResponse.json(
        { success: false, message: "故障報告不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      serializeBigInt({
        success: true,
        data: report
      })
    );

  } catch (err) {
    console.error("GET fault report error:", err);
    return NextResponse.json(
      { success: false, message: "取得故障報告失敗" },
      { status: 500 }
    );
  }
}

/* ===========================
   PUT 更新故障報告
=========================== */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const idParam = params.id;
    let id: bigint;

    try {
      id = BigInt(idParam);
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的故障報告 ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, assigned_to, resolution, severity } = body;

    const existing = await client.fault_reports.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "故障報告不存在" },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (status !== undefined) updateData.status = status;
    if (assigned_to !== undefined)
      updateData.assigned_to = assigned_to ? String(assigned_to) : null;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (severity !== undefined) updateData.severity = severity;

    // 狀態改為 RESOLVED → 設定已解決時間
    if (status === "RESOLVED" && !existing.resolved_at) {
      updateData.resolved_at = new Date();
    }

    const updatedReport = await client.fault_reports.update({
      where: { id },
      data: updateData,
      include: {
        users_fault_reports_user_idTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        },
        users_fault_reports_assigned_toTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        }
      }
    });

    // ⭐ 重要：回傳要 serializeBigInt，否則會 500 然後前端顯示「更新失敗」
    return NextResponse.json(
      serializeBigInt({
        success: true,
        data: updatedReport,
        message: "故障報告更新成功"
      }),
      { status: 200 }
    );

  } catch (err) {
    console.error("Update fault report error:", err);
    return NextResponse.json(
      { success: false, message: "更新故障報告失敗" },
      { status: 500 }
    );
  }
}

/* ===========================
   DELETE 刪除故障報告
=========================== */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const idParam = params.id;
    let id: bigint;

    try {
      id = BigInt(idParam);
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的故障報告 ID" },
        { status: 400 }
      );
    }

    const exists = await client.fault_reports.findUnique({
      where: { id }
    });

    if (!exists) {
      return NextResponse.json(
        { success: false, message: "故障報告不存在" },
        { status: 404 }
      );
    }

    await client.fault_reports.delete({ where: { id } });

    return NextResponse.json(
      serializeBigInt({
        success: true,
        message: "故障報告刪除成功"
      }),
      { status: 200 }
    );

  } catch (err) {
    console.error("Delete fault report error:", err);
    return NextResponse.json(
      { success: false, message: "刪除故障報告失敗" },
      { status: 500 }
    );
  }
}
