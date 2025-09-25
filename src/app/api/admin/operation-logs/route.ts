import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 驗證管理員權限
    let currentUser;
    try {
      currentUser = await AuthUtils.getCurrentUser(request);
    } catch (error) {
      throw error;
    }

    if (!currentUser || !AuthUtils.isAdmin(currentUser)) {
      return NextResponse.json({ 
        error: '未授權訪問', 
        code: 'AUTHENTICATION_REQUIRED',
        message: '請重新登入以獲取有效的認證憑證'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    const entityType = searchParams.get('entityType');
    const actionType = searchParams.get('actionType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = getDatabaseClient();

    // 構建 WHERE 條件 - 使用參數化查詢避免 SQL 注入
    const conditions = [];
    const params = [];
    
    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    
    if (actionType) {
      conditions.push('action_type = ?');
      params.push(actionType);
    }
    
    if (startDate) {
      conditions.push('createdAt >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push('createdAt <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 
      ? ' WHERE ' + conditions.join(' AND ')
      : '';

    // 執行查詢 - 使用參數化查詢
    let countQuery, logsQuery;
    
    if (conditions.length > 0) {
      countQuery = `SELECT COUNT(*) as total FROM operation_logs${whereClause}`;
      logsQuery = `
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
      params.push(limit, offset);
    } else {
      countQuery = `SELECT COUNT(*) as total FROM operation_logs`;
      logsQuery = `
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
        ORDER BY createdAt DESC 
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    }

    // 執行查詢
    const [countResult, logs] = await Promise.all([
      conditions.length > 0 
        ? db.$queryRawUnsafe(countQuery, ...params.slice(0, conditions.length))
        : db.$queryRawUnsafe(countQuery),
      db.$queryRawUnsafe(logsQuery, ...params)
    ]);

    const total = Array.isArray(countResult) ? Number(countResult[0]?.total || 0) : 0;

    return NextResponse.json({
      success: true,
      data: {
        logs: Array.isArray(logs) ? logs : [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('獲取操作日誌失敗:', error);
    
    // 記錄詳細錯誤信息
    if (error instanceof Error) {
      console.error('錯誤詳情:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json({ 
      error: '獲取日誌失敗，請稍後再試' 
    }, { status: 500 });
  }
}
