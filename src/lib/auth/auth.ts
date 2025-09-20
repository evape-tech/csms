import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export interface CurrentUser {
  userId: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export class AuthUtils {
  /**
   * 從 request 或 cookies 獲取當前用戶信息
   */
  static async getCurrentUser(request?: Request): Promise<CurrentUser | null> {
    try {
      let token: string | undefined;

      if (request) {
        // 從 request headers 獲取 cookie
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
          const sessionCookie = cookieHeader
            .split(';')
            .find(c => c.trim().startsWith('session='));
          if (sessionCookie) {
            token = sessionCookie.split('=')[1];
          }
        }
      } else {
        // 從 Next.js cookies 獲取
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');
        token = sessionCookie?.value;
      }

      if (!token) {
        console.log('🔐 [AuthUtils] 未找到 token');
        return null;
      }

      // console.log('🔐 [AuthUtils] 找到 token，正在驗證...');
      // console.log('🔐 [AuthUtils] JWT_SECRET 環境變數:', process.env.JWT_SECRET ? '已設定' : '未設定');
      // console.log('🔐 [AuthUtils] 使用 JWT_SECRET:', process.env.JWT_SECRET || 'your-secret-key');

      // 解析 JWT token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;

      // console.log('🔐 [AuthUtils] JWT 驗證成功，解碼內容:', {
      //   userId: decoded.userId,
      //   uuid: decoded.uuid,
      //   email: decoded.email,
      //   role: decoded.role,
      //   exp: decoded.exp,
      //   iat: decoded.iat
      // });

      return {
        userId: decoded.userId, // 使用 userId，因為 payload 中是 userId: user.uuid
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName
      };

    } catch (error) {
      console.error('🔐 [AuthUtils] 解析用戶信息失敗:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        jwtSecretPresent: !!process.env.JWT_SECRET
      });
      return null;
    }
  }

  /**
   * 從 JWT payload 獲取用戶顯示名稱
   */
  static getUserDisplayName(user: CurrentUser): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  }

  /**
   * 檢查用戶是否有管理員權限
   */
  static isAdmin(user: CurrentUser): boolean {
    return user.role === 'admin' || user.role === 'super_admin';
  }

  /**
   * 從原始 token 字串解析用戶信息（不驗證簽名）
   */
  static parseTokenPayload(token: string): CurrentUser | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      
      // 檢查 token 是否過期
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }
      
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        firstName: payload.firstName,
        lastName: payload.lastName
      };
    } catch {
      return null;
    }
  }
}
