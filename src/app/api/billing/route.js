'use server';

import { NextResponse } from 'next/server';
import { getBillingRecords, generateBillingRecord, getBillingStatistics } from '@/actions/billingActions';
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
 * 获取账单记录
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 账单记录列表
 */
export async function GET(request) {
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
    const cpid = searchParams.get('cpid');
    const transactionId = searchParams.get('transactionId');
    const userId = searchParams.get('userId');
    const idTag = searchParams.get('idTag');

    const result = await getBillingRecords({
      status,
      startDateFrom: startDate,
      startDateTo: endDate,
      cpid,
      transactionId,
      userId,
      idTag
    }, { page, limit });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`获取账单记录失败: ${error.message}`);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * 生成账单
 * @param {Object} request - 请求对象
 * @returns {Promise<Object>} 生成的账单
 */
export async function POST(request) {
  try {
    const session = await checkAuth(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const data = await request.json();
    const result = await generateBillingRecord(data.transactionId, data.options);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`生成账单失败: ${error.message}`);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
