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
 * 获取账单记录列表
 */
export async function GET(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // 构建过滤条件
    const filters = {
      transactionId: searchParams.get('transactionId') || undefined,
      userId: searchParams.get('userId') || undefined,
      idTag: searchParams.get('idTag') || undefined,
      cpid: searchParams.get('cpid') || undefined,
      status: searchParams.get('status') || undefined,
      startDateFrom: searchParams.get('startDateFrom') || undefined,
      startDateTo: searchParams.get('startDateTo') || undefined
    };

    const billings = await billingService.getBillingList(filters, { page, limit });
    return NextResponse.json(billings);
  } catch (error) {
    console.error(`获取账单列表失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 为交易生成账单
 */
export async function POST(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const data = await request.json();
    const { transactionId, tariffId } = data;

    if (!transactionId) {
      return NextResponse.json({ error: '缺少交易ID' }, { status: 400 });
    }

    const billing = await billingService.generateBillingForTransaction(transactionId, { tariffId });
    
    // 記錄操作日誌
    await OperationLogger.log({
      actionType: 'CREATE',
      entityType: 'BILLING',
      entityId: billing.id?.toString(),
      entityName: `帳單#${billing.id} (交易#${transactionId})`,
      description: `為交易 ${transactionId} 生成帳單`
    }, request);

    return NextResponse.json({ billing });
  } catch (error) {
    console.error(`生成账单失败: ${error.message}`);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'CREATE',
        entityType: 'BILLING',
        description: `生成帳單失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
