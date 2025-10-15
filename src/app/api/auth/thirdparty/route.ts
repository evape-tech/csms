import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';
import { OperationLogger } from '../../../../lib/operationLogger';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

/**
 * 統一的第三方登入 API
 * 
 * 支援多種登入方式：
 * - 手機號碼
 * - Google
 * - Facebook
 * - Line
 * - Apple
 * 
 * @route POST /api/auth/thirdparty
 * @body { 
 *   provider: 'phone' | 'google' | 'facebook' | 'line' | 'apple',
 *   phone?: string,              // provider='phone' 時必填
 *   email?: string,              // provider='google'/'facebook' 等時必填
 *   providerUserId?: string,     // 第三方平台的用戶ID
 *   firstName?: string,
 *   lastName?: string,
 *   avatar?: string
 * }
 * @returns { success: boolean, token: string, user: object }
 */
export async function POST(request: NextRequest) {
  let requestBody: any = {}; // 保存請求內容供錯誤日誌使用
  
  try {
    console.log(`🔍 [API /api/auth/thirdparty] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    requestBody = await request.json();
    const body = requestBody;
    const { provider, phone, email, providerUserId, firstName, lastName, avatar } = body;

    // 驗證 provider
    const validProviders = ['phone', 'google', 'facebook', 'line', 'apple'];
    if (!provider || !validProviders.includes(provider)) {
      return NextResponse.json(
        { error: '請提供有效的登入方式 (phone, google, facebook, line, apple)' },
        { status: 400 }
      );
    }

    let user = null;
    let identifier = ''; // 用於日誌記錄

    // 根據不同 provider 處理
    switch (provider) {
      case 'phone':
        // 手機登入
        if (!phone) {
          return NextResponse.json(
            { error: '請提供手機號碼' },
            { status: 400 }
          );
        }

        // 驗證手機號碼格式 (台灣手機: 09xxxxxxxx)
        const phoneRegex = /^09\d{8}$/;
        if (!phoneRegex.test(phone)) {
          return NextResponse.json(
            { error: '手機號碼格式錯誤，請輸入 10 位數字（例：0912345678）' },
            { status: 400 }
          );
        }

        identifier = phone;
        user = await databaseService.getUserByPhone(phone);
        
        if (!user) {
          // 自動創建新用戶
          console.log(`📝 [API /api/auth/thirdparty] Creating new user for phone: ${phone}`);
          const { v4: uuidv4 } = await import('uuid');
          
          user = await databaseService.createUser({
            uuid: uuidv4(),
            phone: phone,
            role: 'user',
            account_status: 'ACTIVE',
            email_verified: false,
            first_name: firstName || null,
            last_name: lastName || null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log(`✅ [API /api/auth/thirdparty] New user created via phone: ${user.uuid}`);
        }
        break;

      case 'google':
      case 'facebook':
      case 'line':
      case 'apple':
        // 第三方平台登入
        if (!email) {
          return NextResponse.json(
            { error: '請提供 Email' },
            { status: 400 }
          );
        }

        identifier = email;
        user = await databaseService.getUserByEmail(email);
        
        if (!user) {
          // 自動創建新用戶
          console.log(`📝 [API /api/auth/thirdparty] Creating new user for ${provider}: ${email}`);
          const { v4: uuidv4 } = await import('uuid');
          
          user = await databaseService.createUser({
            uuid: uuidv4(),
            email: email,
            phone: phone || null,
            role: 'user',
            account_status: 'ACTIVE',
            email_verified: true, // 第三方登入的 email 視為已驗證
            first_name: firstName || null,
            last_name: lastName || null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log(`✅ [API /api/auth/thirdparty] New user created via ${provider}: ${user.uuid}`);
        } else {
          // 更新用戶資訊（如果提供了）
          if (firstName || lastName || phone) {
            await databaseService.updateUser(user.id, {
              first_name: firstName || user.first_name,
              last_name: lastName || user.last_name,
              phone: phone || user.phone,
              updatedAt: new Date()
            });
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: '不支援的登入方式' },
          { status: 400 }
        );
    }

    if (!user) {
      return NextResponse.json(
        { error: '登入失敗，無法取得用戶資訊' },
        { status: 500 }
      );
    }

    // 檢查帳號狀態
    if (user.account_status === 'SUSPENDED' || user.account_status === 'BLOCKED') {
      return NextResponse.json(
        { error: '帳號已被停用，請聯繫客服' },
        { status: 403 }
      );
    }

    // 安全檢查：僅允許一般使用者使用此端點
    if (user.role === 'admin' || user.role === 'super_admin') {
      return NextResponse.json(
        { error: '管理者請使用 email + password 登入' },
        { status: 403 }
      );
    }

    // 創建 JWT token
    const token = jwt.sign(
      { 
        userId: user.uuid,
        phone: user.phone,
        email: user.email,
        role: user.role || 'user',
        firstName: user.first_name || user.firstName || null,
        lastName: user.last_name || user.lastName || null,
        provider: provider
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // 更新用戶登入資訊
    try {
      await databaseService.updateUser(user.id, {
        last_login_at: new Date(),
        login_count: (user.login_count || 0) + 1,
        failed_login_attempts: 0
      });
    } catch (updateError) {
      console.error('更新用戶登入資訊錯誤:', updateError);
    }

    // 記錄登入成功日誌
    try {
      await OperationLogger.logAuthOperation(
        'LOGIN',
        identifier,
        true,
        `第三方登入成功 (${provider}, 使用者: ${user.uuid}, IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄登入日誌錯誤:', logError);
    }

    // 返回 token 和用戶資訊
    const response = NextResponse.json({
      success: true,
      token: token,
      user: {
        id: user.uuid,
        phone: user.phone,
        email: user.email,
        role: user.role || 'user',
        firstName: user.first_name || user.firstName || null,
        lastName: user.last_name || user.lastName || null,
        provider: provider
      }
    });

    // 設置 Cookie
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Third-party login error:', error);
    
    // 記錄系統錯誤
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await OperationLogger.logAuthOperation(
        'LOGIN',
        requestBody.phone || requestBody.email || 'unknown',
        false,
        `第三方登入失敗: 系統錯誤 - ${errorMessage} (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄系統錯誤日誌失敗:', logError);
    }
    
    return NextResponse.json(
      { error: '登入失敗，請稍後再試' },
      { status: 500 }
    );
  }
}
