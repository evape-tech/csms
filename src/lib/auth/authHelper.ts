import jwt from 'jsonwebtoken';
import { CurrentUser } from './auth';

/**
 * 增強的認證輔助函數，支援多種認證方式
 */
export class AuthHelper {
  /**
   * 從 Request 中獲取 Token
   * 支援：1. Authorization Header (Bearer token)
   *       2. Cookie (session)
   */
  static getTokenFromRequest(request: Request): string | null {
    // 方法 1: 從 Authorization header 獲取
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 方法 2: 從 Cookie 獲取
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const sessionCookie = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='));
      if (sessionCookie) {
        return sessionCookie.split('=')[1];
      }
    }

    return null;
  }

  /**
   * 驗證 Token 並返回用戶信息
   */
  static verifyToken(token: string): CurrentUser | null {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName
      };
    } catch (error) {
      console.error('Token 驗證失敗:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 從 Request 中獲取當前用戶（支援多種認證方式）
   */
  static getCurrentUser(request: Request): CurrentUser | null {
    const token = this.getTokenFromRequest(request);
    if (!token) {
      return null;
    }

    return this.verifyToken(token);
  }

  /**
   * 檢查用戶是否有特定角色
   */
  static hasRole(user: CurrentUser | null, ...roles: string[]): boolean {
    if (!user) return false;
    return roles.includes(user.role);
  }

  /**
   * 檢查用戶是否為管理員
   */
  static isAdmin(user: CurrentUser | null): boolean {
    return this.hasRole(user, 'admin');
  }

  /**
   * 檢查用戶是否為一般用戶
   */
  static isUser(user: CurrentUser | null): boolean {
    return this.hasRole(user, 'user');
  }

  /**
   * 檢查用戶是否可以訪問資源（用戶只能訪問自己的資源）
   */
  static canAccessResource(user: CurrentUser | null, resourceUserId: string): boolean {
    if (!user) return false;
    
    // 管理員可以訪問所有資源
    if (this.isAdmin(user)) return true;
    
    // 用戶只能訪問自己的資源
    return user.userId === resourceUserId;
  }
}
