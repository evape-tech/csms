import { NextRequest, NextResponse } from 'next/server';
import { createTariff, getTariffs } from '../../../actions/tariffActions';
import { AuthUtils } from '../../../lib/auth/auth';

// 檢查管理員權限
async function isAdmin(req: NextRequest) {
    try {
        const currentUser = await AuthUtils.getCurrentUser(req);
        return currentUser && AuthUtils.isAdmin(currentUser);
    } catch (error) {
        console.error('驗證管理員身份時發生錯誤:', error);
        return false;
    }
}

// GET /api/tariffs - 獲取所有費率方案
export async function GET(req: NextRequest) {
    try {
        // 檢查管理員權限
        const adminStatus = await isAdmin(req);
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }

        const result = await getTariffs();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('獲取費率方案錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '獲取費率方案失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// POST /api/tariffs - 創建新費率方案
export async function POST(req: NextRequest) {
    try {
        // 檢查管理員權限
        const adminStatus = await isAdmin(req);
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }

        const formData = await req.formData();
        const result = await createTariff(formData);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('創建費率方案錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '創建費率方案失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
