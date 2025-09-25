import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 驗證管理員權限
    const currentUser = await AuthUtils.getCurrentUser(request);
    if (!currentUser || !AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ error: '未授權訪問或權限不足' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    const actionType = searchParams.get('actionType');
    const entityType = searchParams.get('entityType');
    const status = searchParams.get('status');
    const keyword = searchParams.get('keyword');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 檢查資料庫是否已初始化
    let db;
    try {
      db = getDatabaseClient();
    } catch (error: any) {
      if (error.message?.includes('Database not initialized')) {
        // 返回空數據，不顯示模擬資料
        return NextResponse.json({
          success: true,
          usingMockData: false,
          data: {
            logs: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0
            },
            summary: {
              total: 0,
              login: 0,
              logout: 0,
              abnormal: 0,
              warning: 0
            }
          }
        });
      }
      
      throw error;
    }

    // 構建查詢條件
    let whereConditions = [];
    let queryParams = [];

    if (actionType) {
      whereConditions.push('action_type = ?');
      queryParams.push(actionType);
    }

    if (entityType) {
      whereConditions.push('entity_type = ?');
      queryParams.push(entityType);
    }

    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    if (keyword) {
      whereConditions.push('(user_name LIKE ? OR user_email LIKE ? OR description LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (startDate) {
      whereConditions.push('createdAt >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push('createdAt <= ?');
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // 獲取總數
    const countQuery = `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`;
    const countResult = await db.$queryRawUnsafe(countQuery, ...queryParams);
    const total = Array.isArray(countResult) ? Number(countResult[0]?.total || 0) : 0;

    // 獲取日誌記錄
    const dataQuery = `
      SELECT 
        id,
        user_id,
        user_email,
        user_name,
        action_type,
        entity_type,
        entity_id,
        entity_name,
        description,
        status,
        createdAt
      FROM operation_logs 
      ${whereClause}
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;

    const logs = await db.$queryRawUnsafe(dataQuery, ...queryParams, limit, offset);

    // 轉換 BigInt 為 Number 來避免序列化錯誤
    const convertBigIntToNumber = (value: any): number => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return Number(value || 0);
    };

    // 處理 logs 中的 BigInt 字段
    const processedLogs = Array.isArray(logs) ? logs.map((log: any) => ({
      ...log,
      id: convertBigIntToNumber(log.id)
    })) : [];

    // 計算統計數據
    const summaryQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN action_type = 'LOGIN' THEN 1 ELSE 0 END) as login_count,
        SUM(CASE WHEN action_type = 'LOGOUT' THEN 1 ELSE 0 END) as logout_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN description LIKE '%警告%' OR description LIKE '%warning%' THEN 1 ELSE 0 END) as warning_count
      FROM operation_logs
    `;
    
    const summaryResult = await db.$queryRawUnsafe(summaryQuery);
    const summaryData = Array.isArray(summaryResult) ? summaryResult[0] : {};

    return NextResponse.json({
      success: true,
      usingMockData: false,
      data: {
        logs: processedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        summary: {
          total: convertBigIntToNumber(summaryData?.total),
          login: convertBigIntToNumber(summaryData?.login_count),
          logout: convertBigIntToNumber(summaryData?.logout_count),
          abnormal: convertBigIntToNumber(summaryData?.failed_count),
          warning: convertBigIntToNumber(summaryData?.warning_count)
        }
      }
    });

  } catch (error) {
    console.error('獲取操作日誌失敗:', error);
    return NextResponse.json({ 
      error: '獲取操作日誌失敗，請稍後再試' 
    }, { status: 500 });
  }
}
