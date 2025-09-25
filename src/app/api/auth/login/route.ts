import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// 使用統一的 database service
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';
import { OperationLogger } from '../../../../lib/operationLogger';

export async function POST(request: NextRequest) {
  try {
    console.log(`🔍 [API /api/auth/login] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '請提供 email 和密碼' },
        { status: 400 }
      );
    }

    // Find user in database using databaseService
    const user = await databaseService.getUserByEmail(email);
    console.log(`🔍 [API /api/auth/login] Found user via databaseService:`, user ? { id: user.id, email: user.email } : null);
    
    if (!user) {
      // 記錄登入失敗日誌 - 用戶不存在
      try {
        await OperationLogger.logAuthOperation(
          'LOGIN',
          email,
          false,
          `登入失敗: 用戶不存在 (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
        );
      } catch (logError) {
        console.error('記錄登入失敗日誌錯誤:', logError);
      }
      
      return NextResponse.json(
        { error: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // Verify password - support both hashed and plain text passwords
    let isValidPassword = false;
    
    // Ensure password from DB is a string before using string methods
    if (typeof user.password === 'string') {
      // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (user.password.startsWith('$2')) {
        // Hashed password - use bcrypt compare
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        // Plain text password - direct comparison
        isValidPassword = password === user.password;
      }
    } else {
      // No password stored or unexpected type -> invalid
      isValidPassword = false;
    }
    
    if (!isValidPassword) {
      // 記錄登入失敗日誌
      try {
        await OperationLogger.logAuthOperation(
          'LOGIN',
          email,
          false,
          `登入失敗: 密碼錯誤 (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
        );
      } catch (logError) {
        console.error('記錄登入失敗日誌錯誤:', logError);
      }
      
      return NextResponse.json(
        { error: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.uuid, // 使用 UUID 而不是數字 ID，因為外鍵約束需要 UUID
        email: user.email, 
        role: user.role,
        firstName: user.first_name || user.firstName || null,
        lastName: user.last_name || user.lastName || null
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.uuid, // 使用 UUID 保持一致性
        email: user.email,
        role: user.role
      }
    });

    // Set HTTP-only cookie
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // 記錄登入成功日誌
    try {
      await OperationLogger.logAuthOperation(
        'LOGIN',
        user.email,
        true,
        `管理員登入成功 (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
      );
    } catch (logError) {
      console.error('記錄登入成功日誌錯誤:', logError);
      // 登入成功但日誌記錄失敗，不影響登入流程
    }

    return response;

  } catch (error) {
    console.error('Login error:', error);
    
    // 記錄系統錯誤導致的登入失敗
    try {
      const { email } = await request.json().catch(() => ({ email: 'unknown' }));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await OperationLogger.logAuthOperation(
        'LOGIN',
        email,
        false,
        `登入失敗: 系統錯誤 - ${errorMessage} (IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'})`
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
