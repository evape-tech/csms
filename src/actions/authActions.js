"use server";

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

// 直接使用資料庫服務
import DatabaseUtils from '../lib/database/utils.js';
import { databaseService } from '../lib/database/service.js';
import { OperationLogger } from '../lib/operationLogger';

// 新增：非阻塞的欄位自增/更新 helper
async function incrementUserFieldById(userId, field, delta = 1) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    // 若 databaseService 支援直接增量 API
    if (databaseService && typeof databaseService.incrementUserField === 'function') {
      await databaseService.incrementUserField(userId, field, delta);
      return;
    }
    // 讀出使用者，計算後更新
    let user = null;
    if (databaseService && typeof databaseService.getUserById === 'function') {
      user = await databaseService.getUserById(userId);
    } else if (databaseService && typeof databaseService.getUser === 'function') {
      user = await databaseService.getUser(userId);
    }
    const current = user && typeof user[field] !== 'undefined' ? Number(user[field]) || 0 : 0;
    if (databaseService && typeof databaseService.updateUser === 'function') {
      await databaseService.updateUser(userId, { [field]: current + delta });
      return;
    }
    if (databaseService && typeof databaseService.update === 'function') {
      // fallback generic update
      await databaseService.update('users', userId, { [field]: current + delta });
      return;
    }
    // 最後 fallback：呼叫內部 API（非同步、不阻塞）
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/users/${userId}/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, delta })
    }).catch(() => {});
  } catch (err) {
    console.warn('[authActions] incrementUserFieldById failed', err);
  }
}

async function incrementFailedLoginByEmail(email) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const user = (databaseService && typeof databaseService.getUserByEmail === 'function')
      ? await databaseService.getUserByEmail(email)
      : null;
    if (user && user.id) {
      await incrementUserFieldById(user.id, 'failed_login_attempts', 1);
    }
  } catch (err) {
    console.warn('[authActions] incrementFailedLoginByEmail failed', err);
  }
}

async function updateLastLogin(userId) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    // 優先使用 databaseService 明確的更新方法
    if (databaseService && typeof (databaseService).updateUser === 'function') {
      await (databaseService).updateUser(userId, { last_login_at: new Date() });
      return;
    }
    // 如果有其他命名，例如 update 或 patchUser
    if (databaseService && typeof (databaseService).update === 'function') {
      await (databaseService).update('users', userId, { last_login_at: new Date() });
      return;
    }

    // fallback: 若使用 Prisma（範例）
    // import prisma from '@/lib/prisma';
    // await prisma.user.update({ where: { id: Number(userId) }, data: { last_login_at: new Date() } });

    // fallback: 用內部 API 更新（若無 server-side DB helper）
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/users/${userId}/last_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    }).catch(() => {});
  } catch (err) {
    console.warn('[authActions] updateLastLogin failed', err);
  }
}

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

      // 增加失敗次數（非阻塞）
      incrementFailedLoginByEmail(email).catch(() => {});
      
      return {
        success: false,
        error: '帳號或密碼錯誤'
      };
    }

    // 驗證密碼
    let isValidPassword = false;
    if (typeof user.password === 'string') {
      if (user.password.startsWith('$2')) {
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
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

      // 增加失敗次數（非阻塞）
      incrementUserFieldById(user.id, 'failed_login_attempts', 1).catch(() => {});
      
      return {
        success: false,
        error: '帳號或密碼錯誤'
      };
    }

    // 建立 JWT token (30 days expiration)
    const token = jwt.sign(
      { 
        userId: user.uuid, // 使用 UUID 而不是數字 ID，保持與 API route 一致
        email: user.email, 
        role: user.role,
        firstName: user.first_name || user.firstName || null,
        lastName: user.last_name || user.lastName || null
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' } // 30 天
    );

    // 設定 HTTP-only cookie (30 days)
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: false, // 內網 HTTP 訪問需要設為 false
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days (in seconds)
    });

    console.log(`✅ [loginAction] Login successful for user: ${user.email}`);

    // 記錄登入操作日誌
    try {
      await OperationLogger.logAuthOperation('LOGIN', user.email, true, `管理員登入成功`);
    } catch (logError) {
      console.error('登入日誌記錄失敗:', logError);
    }

    // 在這裡更新最後登入時間與登入次數（非阻塞）
    if (user && user.id) {
      updateLastLogin(user.id).catch(() => {});
      incrementUserFieldById(user.id, 'login_count', 1).catch(() => {});
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
