import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

// 強制動態渲染
export const dynamic = 'force-dynamic';

/**
 * 獲取當前用戶的個人資料
 * 支援：
 * - Cookie 認證（管理後台使用）
 * - Authorization Bearer Token 認證（外部使用者網站使用）
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API /api/user/profile] 獲取用戶資料請求');
    
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
    
    console.log('🔍 [API /api/user/profile] 當前用戶:', {
      userId: currentUser.userId,
      email: currentUser.email,
      role: currentUser.role
    });
    
    // 獲取完整的用戶資料
    const user = await databaseService.getUserById(currentUser.userId);
    
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
      firstName: user.first_name || user.firstName,
      lastName: user.last_name || user.lastName,
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
    console.error('[API /api/user/profile] 錯誤:', error);
    return NextResponse.json(
      { error: '獲取用戶資料失敗' },
      { status: 500 }
    );
  }
}

/**
 * 更新當前用戶的個人資料
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔍 [API /api/user/profile] 更新用戶資料請求');
    
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
    const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // 轉換欄位名稱（前端用 camelCase，資料庫用 snake_case）
        const dbField = field === 'firstName' ? 'first_name' :
                       field === 'lastName' ? 'last_name' :
                       field === 'dateOfBirth' ? 'date_of_birth' :
                       field;
        updateData[dbField] = body[field];
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '沒有可更新的欄位' },
        { status: 400 }
      );
    }
    
    // 更新用戶資料
    const updatedUser = await databaseService.updateUser(currentUser.userId, updateData);
    
    return NextResponse.json({
      success: true,
      message: '用戶資料已更新',
      user: {
        id: updatedUser.uuid,
        email: updatedUser.email,
        firstName: updatedUser.first_name || updatedUser.firstName,
        lastName: updatedUser.last_name || updatedUser.lastName,
        phone: updatedUser.phone,
        dateOfBirth: updatedUser.date_of_birth
      }
    });
    
  } catch (error) {
    console.error('[API /api/user/profile] 更新錯誤:', error);
    return NextResponse.json(
      { error: '更新用戶資料失敗' },
      { status: 500 }
    );
  }
}
