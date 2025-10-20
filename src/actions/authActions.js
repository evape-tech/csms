"use server";

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 直接使用資料庫服務
import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';
import { OperationLogger } from '../lib/operationLogger';

export async function loginAction(formData) {
  try {
    const email = formData.get('email');
    const password = formData.get('password');
    const redirectPath = formData.get('next') || '/dashboard';

    console.log(`🔍 [loginAction] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);

    if (!email || !password) {
      return {
        success: false,
        error: '請提供 email 和密碼'
      };
    }

    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 查找用戶
    const user = await databaseService.getUserByEmail(email);
    console.log(`🔍 [loginAction] Found user:`, user ? { id: user.id, email: user.email } : null);
    
    if (!user) {
      // 記錄登入失敗日誌
      try {
        await OperationLogger.logAuthOperation('LOGIN', email, false, `登入失敗: 用戶不存在`);
      } catch (logError) {
        console.error('登入失敗日誌記錄失敗:', logError);
      }
      
      return {
        success: false,
        error: '帳號或密碼錯誤'
      };
    }

    // 驗證密碼
    let isValidPassword = false;
    
    if (typeof user.password === 'string') {
      // 檢查是否為加密密碼
      if (user.password.startsWith('$2')) {
        // 加密密碼 - 使用 bcrypt 比較
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        // 明文密碼 - 直接比較
        isValidPassword = password === user.password;
      }
    } else {
      isValidPassword = false;
    }
    
    if (!isValidPassword) {
      // 記錄登入失敗日誌
      try {
        await OperationLogger.logAuthOperation('LOGIN', email, false, `登入失敗: 密碼錯誤`);
      } catch (logError) {
        console.error('登入失敗日誌記錄失敗:', logError);
      }
      
      return {
        success: false,
        error: '帳號或密碼錯誤'
      };
    }

    // 建立 JWT token (7 days expiration)
    const token = jwt.sign(
      { 
        userId: user.uuid, // 使用 UUID 而不是數字 ID，保持與 API route 一致
        email: user.email, 
        role: user.role,
        firstName: user.first_name || user.firstName || null,
        lastName: user.last_name || user.lastName || null
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' } // 延長到 7 天
    );

    // 設定 HTTP-only cookie (7 days)
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    console.log(`✅ [loginAction] Login successful for user: ${user.email}`);

    // 記錄登入操作日誌
    try {
      await OperationLogger.logAuthOperation('LOGIN', user.email, true, `管理員登入成功`);
    } catch (logError) {
      console.error('登入日誌記錄失敗:', logError);
      // 不要因為日誌失敗而影響登入流程
    }

    // 成功後重定向
    redirect(redirectPath);

  } catch (error) {
    // 過濾掉 NEXT_REDIRECT 錯誤，因為它是正常的重定向流程
    if (error.message === 'NEXT_REDIRECT') {
      throw error; // 重新拋出重定向錯誤以讓 Next.js 處理
    }
    
    console.error('Login action error:', error);
    
    // 如果是重定向錯誤，讓它正常拋出
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    
    return {
      success: false,
      error: '登入失敗，請稍後再試'
    };
  }
}

export async function logoutAction() {
  try {
    // 獲取當前用戶信息以記錄日誌
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    let userEmail = 'unknown';
    
    if (sessionCookie?.value) {
      try {
        const decoded = jwt.verify(sessionCookie.value, process.env.JWT_SECRET || 'your-secret-key');
        userEmail = decoded.email || 'unknown';
      } catch (jwtError) {
        console.warn('JWT 解析失敗:', jwtError);
      }
    }
    
    // 先記錄登出操作日誌（在清除 session 之前）
    try {
      await OperationLogger.logAuthOperation('LOGOUT', userEmail, true, `管理員登出`);
    } catch (logError) {
      console.error('登出日誌記錄失敗:', logError);
      // 不要因為日誌失敗而影響登出流程
    }
    
    // 然後清除 session cookie
    cookieStore.delete('session');
    
    console.log(`✅ [logoutAction] User logged out successfully: ${userEmail}`);
    
    // 重定向到登入頁面
    redirect('/login');
    
  } catch (error) {
    // 過濾掉 NEXT_REDIRECT 錯誤，因為它是正常的重定向流程
    if (error.message === 'NEXT_REDIRECT') {
      throw error; // 重新拋出重定向錯誤以讓 Next.js 處理
    }
    
    console.error('Logout action error:', error);
    
    // 如果是重定向錯誤，讓它正常拋出
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    
    return {
      success: false,
      error: '登出失敗'
    };
  }
}
