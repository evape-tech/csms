import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../lib/database/service';
import DatabaseUtils from '../../../../lib/database/utils';

// 簡易身份驗證檢查 - 在實際環境中，應使用更安全的身份驗證方式
async function isAdmin(req: NextRequest) {
    try {
        // 從請求頭獲取 API 密鑰
        const apiKey = req.headers.get('X-API-Key');
        
        // 檢查 API 密鑰是否匹配管理員 API 密鑰
        const adminApiKey = process.env.ADMIN_API_KEY || 'admin-secret-key';
        
        return apiKey === adminApiKey;
    } catch (error) {
        console.error('驗證管理員身份時出錯:', error);
        return false;
    }
}

/**
 * GET /api/users/[id] - 獲取特定用戶
 * 
 * 此 API 僅限管理員使用，返回特定用戶的資料
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 檢查用戶是否是管理員
        const adminStatus = await isAdmin(req);
        
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }
        
        // 獲取用戶 ID
        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '用戶 ID 未提供'
            }, { status: 400 });
        }
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);
        
        // 查詢用戶
        const user = await databaseService.getUserById(userId);
        
        if (!user) {
            return NextResponse.json({
                success: false,
                message: '用戶不存在'
            }, { status: 404 });
        }
        
        // 移除敏感信息
        const { password, ...safeUser } = user;
        
        return NextResponse.json({
            success: true,
            data: safeUser
        });
        
    } catch (error: any) {
        console.error(`API 錯誤 - 獲取用戶:`, error);
        
        return NextResponse.json({
            success: false,
            message: '獲取用戶資料失敗',
            error: error.message
        }, { status: 500 });
    }
}

/**
 * PUT /api/users/[id] - 更新特定用戶
 * 
 * 此 API 僅限管理員使用，用於更新用戶資料
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 檢查用戶是否是管理員
        const adminStatus = await isAdmin(req);
        
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }
        
        // 獲取用戶 ID
        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '用戶 ID 未提供'
            }, { status: 400 });
        }
        
        // 解析請求體
        const userData = await req.json();
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);
        
        // 檢查用戶是否存在
        const existingUser = await databaseService.getUserById(userId);
        
        if (!existingUser) {
            return NextResponse.json({
                success: false,
                message: '用戶不存在'
            }, { status: 404 });
        }
        
        // 更新用戶資料
        const updatedUser = await databaseService.updateUser(userId, userData);
        
        // 移除敏感信息
        const { password, ...safeUser } = updatedUser;
        
        return NextResponse.json({
            success: true,
            message: '用戶更新成功',
            data: safeUser
        });
        
    } catch (error: any) {
        console.error(`API 錯誤 - 更新用戶:`, error);
        
        return NextResponse.json({
            success: false,
            message: '更新用戶資料失敗',
            error: error.message
        }, { status: 500 });
    }
}

/**
 * DELETE /api/users/[id] - 刪除特定用戶
 * 
 * 此 API 僅限管理員使用，用於刪除用戶
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 檢查用戶是否是管理員
        const adminStatus = await isAdmin(req);
        
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }
        
        // 獲取用戶 ID
        const resolvedParams = await params;
        const userId = resolvedParams.id;
        
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '用戶 ID 未提供'
            }, { status: 400 });
        }
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);
        
        // 檢查用戶是否存在
        const existingUser = await databaseService.getUserById(userId);
        
        if (!existingUser) {
            return NextResponse.json({
                success: false,
                message: '用戶不存在'
            }, { status: 404 });
        }
        
        // 刪除用戶
        await databaseService.deleteUser(userId);
        
        return NextResponse.json({
            success: true,
            message: '用戶刪除成功'
        });
        
    } catch (error: any) {
        console.error(`API 錯誤 - 刪除用戶:`, error);
        
        return NextResponse.json({
            success: false,
            message: '刪除用戶失敗',
            error: error.message
        }, { status: 500 });
    }
}
