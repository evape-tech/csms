import { NextRequest, NextResponse } from 'next/server';
import { updateBillingRecordStatus } from '../../../../../actions/billingActions';
import { AuthUtils } from '../../../../../lib/auth/auth';

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

// PUT /api/billing/records/[id] - 更新計費記錄狀態
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
        const recordId = parseInt(id);
        
        if (isNaN(recordId)) {
            return NextResponse.json({
                success: false,
                message: '無效的計費記錄 ID'
            }, { status: 400 });
        }

        const data = await req.json();
        const { status, ...additionalData } = data;

        if (!status) {
            return NextResponse.json({
                success: false,
                message: '狀態欄位為必填'
            }, { status: 400 });
        }

        const result = await updateBillingRecordStatus(recordId, status, additionalData);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('更新計費記錄狀態錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '更新計費記錄狀態失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
