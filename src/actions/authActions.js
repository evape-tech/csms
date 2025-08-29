"use server";

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 直接使用資料庫服務
const DatabaseUtils = require('../lib/database/utils');
const { databaseService } = require('../lib/database/service');

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
      return {
        success: false,
        error: '帳號或密碼錯誤'
      };
    }

    // 建立 JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // 設定 HTTP-only cookie
    cookies().set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    console.log(`✅ [loginAction] Login successful for user: ${user.email}`);

    // 成功後重定向
    redirect(redirectPath);

  } catch (error) {
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
    // 清除 session cookie
    cookies().delete('session');
    
    console.log(`✅ [logoutAction] User logged out successfully`);
    
    // 重定向到登入頁面
    redirect('/login');
    
  } catch (error) {
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
