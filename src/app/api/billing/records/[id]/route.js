'use server';

import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * 获取指定ID的账单记录
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();
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
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const { status, ...additionalData } = data;

    const billing = await billingService.updateBillingStatus(parseInt(id), status, additionalData);
    return NextResponse.json({ billing });
  } catch (error) {
    logger.error(`更新账单状态失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
