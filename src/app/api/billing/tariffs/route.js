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
 * 获取所有费率方案
 */
export async function GET(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 从URL参数获取过滤条件
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive') === 'true';
    const isDefault = searchParams.get('isDefault') === 'true';
    const type = searchParams.get('type');

    // 构建查询条件
    const where = {};
    if (searchParams.has('isActive')) {
      where.is_active = isActive;
    }
    if (searchParams.has('isDefault')) {
      where.is_default = isDefault;
    }
    if (type) {
      where.tariff_type = type;
    }

    // 从MySQL中获取所有费率方案
    const tariffs = await billingService.mysqlPrisma.tariffs.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ tariffs });
  } catch (error) {
    console.error(`获取费率方案列表失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 创建费率方案
 */
export async function POST(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const data = await request.json();
    const tariff = await billingService.createTariff({
      ...data,
      created_by: session.user.email
    });

    // 記錄操作日誌
    await OperationLogger.logTariffOperation(
      'CREATE',
      tariff.id.toString(),
      data.name || data.tariff_name || '新費率方案',
      `創建費率方案: ${data.name || data.tariff_name}`,
      request
    );

    return NextResponse.json({ tariff });
  } catch (error) {
    console.error(`创建费率方案失败: ${error.message}`);
    
    // 記錄失敗日誌
    try {
      await OperationLogger.log({
        actionType: 'CREATE',
        entityType: 'TARIFF',
        description: `創建費率方案失敗: ${error.message}`,
        status: 'FAILED'
      }, request);
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
