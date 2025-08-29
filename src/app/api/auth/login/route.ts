import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// 使用統一的 database service
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

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
      return NextResponse.json(
        { error: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
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

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '登入失敗，請稍後再試' },
      { status: 500 }
    );
  }
}
