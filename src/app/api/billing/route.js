import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../lib/database/service';
import DatabaseUtils from '../../../lib/database/utils';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// 檢查管理員權限
async function isAdmin(req) {
  try {
    const { AuthUtils } = await import('../../../lib/auth/auth');
    const currentUser = await AuthUtils.getCurrentUser(req);
    return currentUser && AuthUtils.isAdmin(currentUser);
  } catch (error) {
    console.error('驗證管理員身份時發生錯誤:', error);
    return false;
  }
}

/**
 * 获取账单记录
 * @param {NextRequest} request - 请求对象
 * @returns {Promise<Object>} 账单记录列表
 */
export async function GET(request) {
  try {
    // 檢查管理員權限
    const adminStatus = await isAdmin(request);
    if (!adminStatus) {
      return NextResponse.json({
        success: false,
        message: '權限不足，僅管理員可以訪問此 API'
      }, { status: 403 });
    }

    console.log(`🔍 [API /api/billing] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

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

    // 構建過濾條件
    const where = {};
    
    if (status) where.status = status;
    if (cpid) where.cpid = { contains: cpid };
    if (transactionId) where.transaction_id = { contains: transactionId };
    if (userId) where.user_id = { contains: userId };
    if (idTag) where.id_tag = { contains: idTag };
    
    if (startDate && endDate) {
      where.start_time = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (startDate) {
      where.start_time = { gte: new Date(startDate) };
    } else if (endDate) {
      where.start_time = { lte: new Date(endDate) };
    }

    // 獲取總數
    const allRecords = await databaseService.getBillingRecords(where);
    const total = allRecords.length;

    // 分頁計算
    const skip = (page - 1) * limit;
    const records = allRecords.slice(skip, skip + limit);

    console.log(`✅ [API /api/billing] Found ${total} total records, returning ${records.length} records`);

    const result = {
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API /api/billing] 获取账单记录失败:`, error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 生成账单
 * @param {NextRequest} request - 请求对象
 * @returns {Promise<Object>} 生成的账单
 */
export async function POST(request) {
  try {
    // 檢查管理員權限
    const adminStatus = await isAdmin(request);
    if (!adminStatus) {
      return NextResponse.json({
        success: false,
        message: '權限不足，僅管理員可以訪問此 API'
      }, { status: 403 });
    }

    console.log(`🔍 [API /api/billing POST] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const data = await request.json();
    
    // 這裡應該實現計費邏輯，暫時返回成功狀態
    // 實際生產環境中需要根據 transactionId 和 options 生成計費記錄
    console.log('📝 [API /api/billing POST] 生成計費記錄請求:', {
      transactionId: data.transactionId,
      options: data.options
    });

    // 暫時模擬生成成功
    const result = {
      success: true,
      message: '計費記錄生成請求已接收',
      data: {
        transactionId: data.transactionId,
        status: 'PENDING',
        timestamp: new Date().toISOString()
      }
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API /api/billing POST] 生成账单失败:`, error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
