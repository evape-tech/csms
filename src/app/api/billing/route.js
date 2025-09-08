'use server';

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { auth } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * 获取所有费率方案
 * @returns {Promise<Object>} 费率方案列表
 */
export async function getTariffs(request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 从MySQL中获取所有费率方案
    const tariffs = await billingService.mysqlPrisma.tariffs.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ tariffs });
  } catch (error) {
    logger.error(`获取费率方案列表失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 创建费率方案
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 创建的费率方案
 */
export async function createTariff(request) {
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

    revalidatePath('/pricing_management');
    return NextResponse.json({ tariff });
  } catch (error) {
    logger.error(`创建费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 更新费率方案
 * @param {Object} request - 请求对象
 * @param {Object} params - 路径参数
 * @returns {Promise<Object>} 更新后的费率方案
 */
export async function updateTariff(request, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const tariff = await billingService.updateTariff(parseInt(id), data);

    revalidatePath('/pricing_management');
    return NextResponse.json({ tariff });
  } catch (error) {
    logger.error(`更新费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 删除费率方案
 * @param {Object} request - 请求对象
 * @param {Object} params - 路径参数
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteTariff(request, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const result = await billingService.deleteTariff(parseInt(id));

    revalidatePath('/pricing_management');
    return NextResponse.json(result);
  } catch (error) {
    logger.error(`删除费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 获取账单列表
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 账单列表
 */
export async function getBillings(request) {
  try {
    const session = await auth();
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
    logger.error(`获取账单列表失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 为交易生成账单
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 生成的账单
 */
export async function generateBilling(request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const data = await request.json();
    const { transactionId, tariffId } = data;

    if (!transactionId) {
      return NextResponse.json({ error: '缺少交易ID' }, { status: 400 });
    }

    const billing = await billingService.generateBillingForTransaction(transactionId, { tariffId });
    return NextResponse.json({ billing });
  } catch (error) {
    logger.error(`生成账单失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 更新账单状态
 * @param {Object} request - 请求对象
 * @param {Object} params - 路径参数
 * @returns {Promise<Object>} 更新后的账单
 */
export async function updateBillingStatus(request, { params }) {
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
