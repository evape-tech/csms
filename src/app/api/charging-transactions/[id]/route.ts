import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * Get a specific charging transaction by ID
 * 
 * @route GET /api/charging-transactions/[id]
 * @auth Bearer Token or Cookie
 * @param id - Transaction ID (transaction_id string or database id)
 * 
 * @returns { success: boolean, transaction: {...} }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    console.log(`🔍 [API /api/charging-transactions/${id}] 查詢充電交易記錄`);

    let transaction = null;

    // 嘗試先使用 transaction_id 查詢（字符串）
    try {
      transaction = await databaseService.getTransaction(id);
    } catch (error) {
      // 如果失敗，嘗試使用數字 ID 查詢
      if (!isNaN(Number(id))) {
        transaction = await databaseService.getTransactionById(Number(id));
      }
    }

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到指定的充電交易記錄'
        },
        { status: 404 }
      );
    }

    // 格式化返回資料
    const formattedTransaction = {
      id: Number(transaction.id),
      transaction_id: transaction.transaction_id,
      start_time: transaction.start_time,
      end_time: transaction.end_time,
      cpid: transaction.cpid,
      cpsn: transaction.cpsn,
      connector_id: transaction.connector_id,
      user_id: transaction.user_id,
      id_tag: transaction.id_tag,
      meter_start: transaction.meter_start ? Number(transaction.meter_start) : null,
      meter_stop: transaction.meter_stop ? Number(transaction.meter_stop) : null,
      energy_consumed: transaction.energy_consumed ? Number(transaction.energy_consumed) : null,
      current_power: transaction.current_power ? Number(transaction.current_power) : null,
      current_voltage: transaction.current_voltage ? Number(transaction.current_voltage) : null,
      current_current: transaction.current_current ? Number(transaction.current_current) : null,
      charging_duration: transaction.charging_duration,
      status: transaction.status,
      stop_reason: transaction.stop_reason,
      last_meter_update: transaction.last_meter_update,
      created_at: transaction.createdAt,
      updated_at: transaction.updatedAt
    };

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction
    });

  } catch (error) {
    console.error('[API /api/charging-transactions/[id]] error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '取得充電交易記錄失敗' 
      },
      { status: 500 }
    );
  }
}

/**
 * Update a charging transaction
 * 
 * @route PUT /api/charging-transactions/[id]
 * @auth Bearer Token or Cookie
 * @param id - Transaction ID (transaction_id string or database id)
 * @body { end_time?, meter_stop?, energy_consumed?, current_power?, current_voltage?, current_current?, status?, stop_reason?, charging_duration? }
 * 
 * @returns { success: boolean, transaction: {...} }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    console.log(`📝 [API /api/charging-transactions/${id}] 更新充電交易記錄`);

    // 檢查交易是否存在
    let existingTransaction = null;
    try {
      existingTransaction = await databaseService.getTransaction(id);
    } catch (error) {
      if (!isNaN(Number(id))) {
        existingTransaction = await databaseService.getTransactionById(Number(id));
      }
    }

    if (!existingTransaction) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到指定的充電交易記錄'
        },
        { status: 404 }
      );
    }

    // 構建更新資料
    const updateData: any = {};

    if (body.end_time !== undefined) {
      updateData.end_time = body.end_time ? new Date(body.end_time) : null;
    }
    if (body.meter_stop !== undefined) {
      updateData.meter_stop = body.meter_stop ? parseFloat(body.meter_stop) : null;
    }
    if (body.energy_consumed !== undefined) {
      updateData.energy_consumed = body.energy_consumed ? parseFloat(body.energy_consumed) : null;
    }
    if (body.current_power !== undefined) {
      updateData.current_power = body.current_power ? parseFloat(body.current_power) : null;
    }
    if (body.current_voltage !== undefined) {
      updateData.current_voltage = body.current_voltage ? parseFloat(body.current_voltage) : null;
    }
    if (body.current_current !== undefined) {
      updateData.current_current = body.current_current ? parseFloat(body.current_current) : null;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.stop_reason !== undefined) {
      updateData.stop_reason = body.stop_reason;
    }
    if (body.charging_duration !== undefined) {
      updateData.charging_duration = body.charging_duration;
    }
    if (body.last_meter_update !== undefined) {
      updateData.last_meter_update = body.last_meter_update ? new Date(body.last_meter_update) : null;
    }

    // 如果有提供 end_time，自動計算充電時長
    if (updateData.end_time && existingTransaction.start_time) {
      const startTime = new Date(existingTransaction.start_time);
      const endTime = new Date(updateData.end_time);
      updateData.charging_duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    }

    // 更新交易記錄
    let updatedTransaction;
    if (!isNaN(Number(id))) {
      updatedTransaction = await databaseService.updateTransactionById(Number(id), updateData);
    } else {
      updatedTransaction = await databaseService.updateTransaction(id, updateData);
    }

    // 格式化返回資料
    const formattedTransaction = {
      id: Number(updatedTransaction.id),
      transaction_id: updatedTransaction.transaction_id,
      start_time: updatedTransaction.start_time,
      end_time: updatedTransaction.end_time,
      cpid: updatedTransaction.cpid,
      cpsn: updatedTransaction.cpsn,
      connector_id: updatedTransaction.connector_id,
      user_id: updatedTransaction.user_id,
      id_tag: updatedTransaction.id_tag,
      meter_start: updatedTransaction.meter_start ? Number(updatedTransaction.meter_start) : null,
      meter_stop: updatedTransaction.meter_stop ? Number(updatedTransaction.meter_stop) : null,
      energy_consumed: updatedTransaction.energy_consumed ? Number(updatedTransaction.energy_consumed) : null,
      current_power: updatedTransaction.current_power ? Number(updatedTransaction.current_power) : null,
      current_voltage: updatedTransaction.current_voltage ? Number(updatedTransaction.current_voltage) : null,
      current_current: updatedTransaction.current_current ? Number(updatedTransaction.current_current) : null,
      charging_duration: updatedTransaction.charging_duration,
      status: updatedTransaction.status,
      stop_reason: updatedTransaction.stop_reason,
      last_meter_update: updatedTransaction.last_meter_update,
      created_at: updatedTransaction.createdAt,
      updated_at: updatedTransaction.updatedAt
    };

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
      message: '成功更新充電交易記錄'
    });

  } catch (error) {
    console.error('[API /api/charging-transactions/[id]] error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '更新充電交易記錄失敗',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Delete a charging transaction
 * 
 * @route DELETE /api/charging-transactions/[id]
 * @auth Bearer Token or Cookie
 * @param id - Transaction ID (transaction_id string)
 * 
 * @returns { success: boolean, message: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者身份
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { 
          success: false,
          error: '未登入或 token 無效' 
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    console.log(`🗑️ [API /api/charging-transactions/${id}] 刪除充電交易記錄`);

    // 檢查交易是否存在
    let existingTransaction = null;
    try {
      existingTransaction = await databaseService.getTransaction(id);
    } catch (error) {
      if (!isNaN(Number(id))) {
        existingTransaction = await databaseService.getTransactionById(Number(id));
      }
    }

    if (!existingTransaction) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到指定的充電交易記錄'
        },
        { status: 404 }
      );
    }

    // 刪除交易記錄（只能使用 transaction_id）
    if (!existingTransaction.transaction_id) {
      return NextResponse.json(
        {
          success: false,
          error: '無法刪除：缺少 transaction_id'
        },
        { status: 400 }
      );
    }

    await databaseService.deleteTransaction(existingTransaction.transaction_id);

    return NextResponse.json({
      success: true,
      message: '成功刪除充電交易記錄'
    });

  } catch (error) {
    console.error('[API /api/charging-transactions/[id]] error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '刪除充電交易記錄失敗',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

