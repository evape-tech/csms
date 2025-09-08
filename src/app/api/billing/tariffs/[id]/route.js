'use server';

import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * 获取指定ID的费率方案
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();
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
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const tariff = await billingService.updateTariff(parseInt(id), data);

    return NextResponse.json({ tariff });
  } catch (error) {
    logger.error(`更新费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 删除指定ID的费率方案
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const result = await billingService.deleteTariff(parseInt(id));

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`删除费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
