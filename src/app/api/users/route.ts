import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../lib/database/service';
import DatabaseUtils from '../../../lib/database/utils';
import { cookies } from 'next/headers';

/**
 * 檢查請求是否來自管理員
 * @param req NextRequest 對象
 * @returns 是否是管理員
 */
// 簡易身份驗證檢查 - 在實際環境中，應使用更安全的身份驗證方式
async function isAdmin(req: NextRequest) {
    try {
        // 從請求頭獲取 API 密鑰
        const apiKey = req.headers.get('X-API-Key');
        
        // 檢查 API 密鑰是否匹配管理員 API 密鑰
        // 注意: 在生產環境中，這應該使用更安全的方法來驗證管理員身份
        const adminApiKey = process.env.ADMIN_API_KEY || 'admin-secret-key';
        
        return apiKey === adminApiKey;
    } catch (error) {
        console.error('驗證管理員身份時出錯:', error);
        return false;
    }
}

/**
 * GET /api/users - 獲取所有用戶
 * 
 * 此 API 僅限管理員使用，返回系統中的所有用戶資料
 */
export async function GET(req: NextRequest) {
    try {
        // 檢查用戶是否已登入並且是管理員
        const adminStatus = await isAdmin(req);
        
        if (!adminStatus) {
            return NextResponse.json({ 
                success: false, 
                message: '權限不足，僅管理員可以訪問此 API' 
            }, { status: 403 });
        }
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);
        
        // 從 URL 參數中獲取可選的過濾條件
        const searchParams = req.nextUrl.searchParams;
        const role = searchParams.get('role');
        
        // 準備查詢條件
        const where: any = {};
        if (role) {
            where.role = role;
        }
        
        // 查詢用戶資料
        const users = await databaseService.getUsers(where);
        
        // 移除敏感資訊 (密碼)
        const sanitizedUsers = users.map((user: any) => {
            const { password, ...safeUser } = user;
            return safeUser;
        });
        
        return NextResponse.json({ 
            success: true, 
            data: sanitizedUsers,
            count: sanitizedUsers.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('API 錯誤 - 獲取用戶:', error);
        
        return NextResponse.json({ 
            success: false, 
            message: '獲取用戶資料失敗',
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * POST /api/users - 創建新用戶
 * 
 * 此 API 僅限管理員使用，用於創建新的用戶帳號
 */
export async function POST(req: NextRequest) {
    try {
        // 檢查用戶是否是管理員
        const adminStatus = await isAdmin(req);
        
        if (!adminStatus) {
            return NextResponse.json({ 
                success: false, 
                message: '權限不足，僅管理員可以訪問此 API' 
            }, { status: 403 });
        }
        
        // 解析請求體
        const userData = await req.json();
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);
        
        // 創建新用戶
        const newUser = await databaseService.createUser(userData);
        
        // 移除密碼後返回新用戶資料
        const { password, ...safeUser } = newUser;
        
        return NextResponse.json({ 
            success: true, 
            message: '用戶創建成功',
            data: safeUser
        }, { status: 201 });
        
    } catch (error: any) {
        console.error('API 錯誤 - 創建用戶:', error);
        
        return NextResponse.json({ 
            success: false, 
            message: '創建用戶失敗',
            error: error.message 
        }, { status: 500 });
    }
}
