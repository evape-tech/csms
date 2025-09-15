'use server';

import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { auth } from '@/lib/auth';

/**
 * 获取所有费率方案
 */
export async function GET(request) {
  try {
    const session = await auth();
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
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const data = await request.json();
    const tariff = await billingService.createTariff({
      ...data,
      created_by: session.user.email
    });

    return NextResponse.json({ tariff });
  } catch (error) {
    console.error(`创建费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
