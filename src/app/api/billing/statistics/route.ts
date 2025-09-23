import { NextRequest, NextResponse } from 'next/server';
import { getBillingStatistics } from '../../../../actions/billingActions';
import { AuthUtils } from '../../../../lib/auth/auth';

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

// GET /api/billing/statistics - 獲取計費統計信息
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

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const cpid = searchParams.get('cpid');
        const status = searchParams.get('status');

        const result = await getBillingStatistics({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            cpid: cpid || undefined,
            status: status || undefined
        });
        
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('獲取計費統計錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '獲取計費統計失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
