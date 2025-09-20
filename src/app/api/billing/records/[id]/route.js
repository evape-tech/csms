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
 * 获取指定ID的账单记录
 */
export async function GET(request, { params }) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = params;
    const billing = await billingService.mysqlPrisma.billing_records.findUnique({
      where: { id: parseInt(id) },
      include: {
        tariff: true
      }
    });

    if (!billing) {
      return NextResponse.json({ error: '账单记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ billing });
  } catch (error) {
    logger.error(`获取账单记录失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 更新账单状态
 */
export async function PATCH(request, { params }) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const { status, ...additionalData } = data;

    const billing = await billingService.updateBillingStatus(parseInt(id), status, additionalData);
    
    // 記錄操作日誌
    await OperationLogger.log({
      actionType: 'UPDATE',
      entityType: 'BILLING',
      entityId: id,
      entityName: `帳單#${id}`,
      description: `更新帳單狀態為: ${status}`
    }, request);

    return NextResponse.json({ billing });
  } catch (error) {
    logger.error(`更新账单状态失败: ${error.message}`);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'UPDATE',
        entityType: 'BILLING',
        entityId: params.id,
        description: `更新帳單狀態失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
