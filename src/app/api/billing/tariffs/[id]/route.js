'use server';

import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { AuthUtils } from '@/lib/auth/auth';
import { OperationLogger } from '@/lib/operationLogger';

// 簡單的認證檢查函數
async function checkAuth(request) {
  const user = await AuthUtils.getCurrentUser(request);
  if (!user || !AuthUtils.isAdmin(user)) {
    return null;
  }
  return {
    user: {
      uuid: user.userId, // 使用 UUID 作為用戶識別符
      userId: user.userId, // 保持 userId 字段以向後兼容
      role: user.role,
      email: user.email
    }
  };
}

/**
 * 获取指定ID的费率方案
 */
export async function GET(request, { params }) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = params;
    const tariff = await billingService.getTariffById(parseInt(id));

    if (!tariff) {
      return NextResponse.json({ error: '费率方案不存在' }, { status: 404 });
    }

    return NextResponse.json({ tariff });
  } catch (error) {
    logger.error(`获取费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 更新指定ID的费率方案
 */
export async function PUT(request, { params }) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const tariff = await billingService.updateTariff(parseInt(id), data);

    // 記錄操作日誌
    await OperationLogger.logTariffOperation(
      'UPDATE',
      id,
      tariff.name || tariff.tariff_name || `費率方案#${id}`,
      `更新費率方案: ${tariff.name || tariff.tariff_name}`,
      request
    );

    return NextResponse.json({ tariff });
  } catch (error) {
    logger.error(`更新费率方案失败: ${error.message}`);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'UPDATE',
        entityType: 'TARIFF',
        entityId: params.id,
        description: `更新費率方案失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 删除指定ID的费率方案
 */
export async function DELETE(request, { params }) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    
    // 先獲取費率方案信息用於日誌
    const tariff = await billingService.getTariffById(parseInt(id));
    const tariffName = tariff?.name || tariff?.tariff_name || `費率方案#${id}`;
    
    const result = await billingService.deleteTariff(parseInt(id));

    // 記錄操作日誌
    await OperationLogger.logTariffOperation(
      'DELETE',
      id,
      tariffName,
      `刪除費率方案: ${tariffName}`,
      request
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`删除费率方案失败: ${error.message}`);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'DELETE',
        entityType: 'TARIFF',
        entityId: params.id,
        description: `刪除費率方案失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
