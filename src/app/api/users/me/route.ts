import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

// 強制動態渲染
export const dynamic = 'force-dynamic';

/**
 * 獲取當前用戶的個人資料
 * 
 * 支援：
 * - Cookie 認證（管理後台使用）
 * - Authorization Bearer Token 認證（外部使用者網站使用）
 * 
 * 無論是管理員還是一般用戶，都只能查詢自己的資料
 * 
 * @route GET /api/users/me
 * @auth Cookie 或 Bearer Token
 * @returns { success: boolean, user: { id, email, role, ... } }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API /api/users/me] 獲取用戶資料請求');
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 獲取當前用戶（支援多種認證方式）
    const currentUser = AuthHelper.getCurrentUser(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: '未登入或 token 無效' },
        { status: 401 }
      );
    }
    
    console.log('🔍 [API /api/users/me] 當前用戶:', {
      userId: currentUser.userId,
      email: currentUser.email,
      role: currentUser.role
    });
    
    // 獲取完整的用戶資料（使用 UUID）
    const user = await databaseService.getUserByUuid(currentUser.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: '用戶不存在' },
        { status: 404 }
      );
    }
    
    // 返回用戶資料（不包含敏感信息如密碼）
    const userProfile = {
      id: user.uuid,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      dateOfBirth: user.date_of_birth,
      emailVerified: user.email_verified,
      accountStatus: user.account_status,
      lastLoginAt: user.last_login_at,
      loginCount: user.login_count,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    return NextResponse.json({
      success: true,
      user: userProfile
    });
    
  } catch (error) {
    console.error('[API /api/users/me] 錯誤:', error);
    return NextResponse.json(
      { error: '獲取用戶資料失敗' },
      { status: 500 }
    );
  }
}

/**
 * 更新當前用戶的個人資料
 * 
 * 支援：
 * - Cookie 認證（管理後台使用）
 * - Authorization Bearer Token 認證（外部使用者網站使用）
 * 
 * 用戶只能更新自己的資料，不能更新其他用戶
 * 
 * @route PATCH /api/users/me
 * @auth Cookie 或 Bearer Token
 * @body { email?: string, firstName?: string, lastName?: string, phone?: string, dateOfBirth?: string }
 * @returns { success: boolean, message: string, user: { ... } }
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔍 [API /api/users/me] 更新用戶資料請求');
    
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const currentUser = AuthHelper.getCurrentUser(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: '未登入或 token 無效' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // 只允許更新特定欄位
    const allowedFields = ['email', 'firstName', 'lastName', 'phone', 'dateOfBirth'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 轉換欄位名稱（前端用 camelCase，資料庫用 snake_case）
        const dbField = field === 'firstName' ? 'first_name' :
                       field === 'lastName' ? 'last_name' :
                       field === 'dateOfBirth' ? 'date_of_birth' :
                       field;
        
        let value = body[field];
        
        // 驗證 email 格式
        if (dbField === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return NextResponse.json(
              { error: '電子郵件格式無效' },
              { status: 400 }
            );
          }
          // 轉換為小寫
          value = value.toLowerCase();
        }
        
        // 如果是 dateOfBirth，轉換為完整的 ISO-8601 DateTime 格式
        if (dbField === 'date_of_birth' && value) {
          try {
            // 如果只收到日期格式 (YYYY-MM-DD)，轉換為 DateTime (YYYY-MM-DDTHH:mm:ss.sssZ)
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              // 將日期設為當天 00:00:00 UTC
              value = new Date(value + 'T00:00:00Z').toISOString();
            } else if (!(value instanceof Date) && typeof value === 'string') {
              // 如果是字串但不是日期格式，嘗試解析
              value = new Date(value).toISOString();
            }
          } catch (e) {
            console.error('日期格式轉換失敗:', e);
            return NextResponse.json(
              { error: '出生日期格式無效，請使用 YYYY-MM-DD 格式' },
              { status: 400 }
            );
          }
        }
        
        updateData[dbField] = value;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '沒有可更新的欄位' },
        { status: 400 }
      );
    }
    
    // 更新用戶資料（使用 UUID）
    const updatedUser = await databaseService.updateUserByUuid(currentUser.userId, updateData);
    
    return NextResponse.json({
      success: true,
      message: '用戶資料已更新',
      user: {
        id: updatedUser.uuid,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        dateOfBirth: updatedUser.date_of_birth
      }
    });
    
  } catch (error) {
    console.error('[API /api/users/me] 更新錯誤:', error);
    return NextResponse.json(
      { error: '更新用戶資料失敗' },
      { status: 500 }
    );
  }
}
