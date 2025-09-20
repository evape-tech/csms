'use server';

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import billingService from '@/lib/services/billingService';
import { AuthUtils } from '@/lib/auth/auth';

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
 * @returns {Promise<Object>} 费率方案列表
 */
export async function getTariffs(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const tariffs = await billingService.mysqlPrisma.tariffs.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ tariffs });
  } catch (error) {
    console.error(`获取费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 创建新费率方案
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 创建的费率方案
 */
export async function createTariff(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const data = await request.json();
    const tariff = await billingService.createTariff(data);
    
    revalidatePath('/billing/tariffs');
    return NextResponse.json({ tariff });
  } catch (error) {
    console.error(`创建费率方案失败: ${error.message}`);
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
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const tariff = await billingService.updateTariff(parseInt(id), data);
    
    revalidatePath('/billing/tariffs');
    return NextResponse.json({ tariff });
  } catch (error) {
    console.error(`更新费率方案失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 获取账单记录
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 账单记录列表
 */
export async function getBillingRecords(request) {
  try {
    const session = await checkAuth(request);
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const records = await billingService.getBillingRecords({
      page,
      limit,
      status,
      startDate,
      endDate
    });
    
    return NextResponse.json({ records });
  } catch (error) {
    console.error(`获取账单记录失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 生成账单
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 生成的账单
 */
export async function generateBilling(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const data = await request.json();
    const billing = await billingService.generateBilling(data);
    
    revalidatePath('/billing/records');
    return NextResponse.json({ billing });
  } catch (error) {
    console.error(`生成账单失败: ${error.message}`);
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
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { id } = params;
    const data = await request.json();
    const { status, ...additionalData } = data;

    const billing = await billingService.updateBillingStatus(parseInt(id), status, additionalData);
    
    revalidatePath('/billing/records');
    return NextResponse.json({ billing });
  } catch (error) {
    console.error(`更新账单状态失败: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
