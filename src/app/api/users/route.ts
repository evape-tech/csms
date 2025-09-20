import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../lib/database/service';
import DatabaseUtils from '../../../lib/database/utils';
import { cookies } from 'next/headers';

// 簡易身份驗證檢查
async function isAdmin(req: NextRequest) {
    try {

        const { AuthUtils } = await import('../../../lib/auth/auth');

        let currentUser;
        try {
            currentUser = await AuthUtils.getCurrentUser(req);
        } catch (error) {
            console.error('🔐 [isAdmin] 獲取用戶信息失敗:', error);
            throw error;
        }

        const isAdminUser = currentUser && AuthUtils.isAdmin(currentUser);

        return isAdminUser;
    } catch (error) {
        console.error('🔐 [isAdmin] 驗證管理員身份時發生錯誤:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return false;
    }
}

export async function GET(req: NextRequest) {
    try {

        // 檢查用戶是否已登入並且是管理員
        let adminStatus;
        try {
            adminStatus = await isAdmin(req);
        } catch (error) {
            console.error('📋 [GET /api/users] 管理員權限檢查失敗:', error);
            throw error;
        }

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
        console.error('📋 [GET /api/users] API 錯誤 - 獲取用戶:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });

        return NextResponse.json({
            success: false,
            message: '獲取用戶資料失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

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
        console.error('➕ [POST /api/users] API 錯誤 - 創建用戶:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });

        return NextResponse.json({
            success: false,
            message: '創建用戶失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
