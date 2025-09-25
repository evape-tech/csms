import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../lib/database/service';
import DatabaseUtils from '../../../../../lib/database/utils';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// 檢查管理員權限
async function isAdmin(req: NextRequest) {
    try {
        const { AuthUtils } = await import('../../../../../lib/auth/auth');
        const currentUser = await AuthUtils.getCurrentUser(req);
        return currentUser && AuthUtils.isAdmin(currentUser);
    } catch (error) {
        console.error('驗證管理員身份時發生錯誤:', error);
        return false;
    }
}

// GET /api/billing/records/[id] - 獲取單個計費記錄詳情
export async function GET(
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

        console.log(`🔍 [API /api/billing/records/${id} GET] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);

        // 獲取計費記錄詳情
        const record = await databaseService.getBillingRecordById(recordId);

        if (!record) {
            return NextResponse.json({
                success: false,
                message: '找不到指定的計費記錄'
            }, { status: 404 });
        }

        console.log(`✅ [API /api/billing/records/${id} GET] 找到記錄`);

        return NextResponse.json({
            success: true,
            data: record,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[API /api/billing/records/[id] GET] 獲取計費記錄詳情錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '獲取計費記錄詳情失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
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

        console.log(`🔍 [API /api/billing/records/${id}] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);

        // 驗證狀態是否有效
        const validStatuses = ['PENDING', 'CALCULATED', 'INVOICED', 'PAID', 'CANCELLED', 'ERROR'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({
                success: false,
                message: `無效的計費狀態: ${status}。有效狀態: ${validStatuses.join(', ')}`
            }, { status: 400 });
        }

        // 更新計費記錄
        const updatedRecord = await databaseService.updateBillingRecord(recordId, {
            status,
            ...additionalData,
            updatedAt: new Date()
        });

        console.log(`✅ [API /api/billing/records/${id}] 更新成功`);

        return NextResponse.json({
            success: true,
            message: '計費記錄狀態更新成功',
            data: updatedRecord,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('更新計費記錄狀態錯誤:', error);
        return NextResponse.json({
            success: false,
            message: '更新計費記錄狀態失敗',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
