import { NextRequest, NextResponse } from 'next/server';
import { updateTariff, deleteTariff } from '../../../../actions/tariffActions';
import { AuthUtils } from '../../../../lib/auth/auth';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

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

// PUT /api/tariffs/[id] - 更新費率方案
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 檢查管理員權限
        const adminStatus = await isAdmin(req);
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }

        const { id } = await params;
        const tariffId = parseInt(id);
        
        if (isNaN(tariffId)) {
            return NextResponse.json({
                success: false,
                message: '無效的費率方案 ID'
            }, { status: 400 });
        }

        const formData = await req.formData();
        const result = await updateTariff(tariffId, formData);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('更新費率方案錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '更新費率方案失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// DELETE /api/tariffs/[id] - 刪除費率方案
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 檢查管理員權限
        const adminStatus = await isAdmin(req);
        if (!adminStatus) {
            return NextResponse.json({
                success: false,
                message: '權限不足，僅管理員可以訪問此 API'
            }, { status: 403 });
        }

        const { id } = await params;
        const tariffId = parseInt(id);
        
        if (isNaN(tariffId)) {
            return NextResponse.json({
                success: false,
                message: '無效的費率方案 ID'
            }, { status: 400 });
        }

        const result = await deleteTariff(tariffId);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('刪除費率方案錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '刪除費率方案失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
