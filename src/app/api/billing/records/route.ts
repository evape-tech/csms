import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../lib/database/service';
import DatabaseUtils from '../../../../lib/database/utils';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// 檢查管理員權限
async function isAdmin(req: NextRequest) {
    try {
        const { AuthUtils } = await import('../../../../lib/auth/auth');
        const currentUser = await AuthUtils.getCurrentUser(req);
        return currentUser && AuthUtils.isAdmin(currentUser);
    } catch (error) {
        console.error('驗證管理員身份時發生錯誤:', error);
        return false;
    }
}

// GET /api/billing/records - 獲取計費記錄列表
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

        console.log(`🔍 [API /api/billing/records] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const cpid = searchParams.get('cpid');
        const transactionId = searchParams.get('transactionId');
        const userId = searchParams.get('userId');
        const idTag = searchParams.get('idTag');

        // 構建過濾條件
        const where: any = {};
        
        if (status) where.status = status;
        if (cpid) where.cpid = { contains: cpid };
        if (transactionId) where.transaction_id = { contains: transactionId };
        if (userId) where.user_id = { contains: userId };
        if (idTag) where.id_tag = { contains: idTag };
        
        if (startDate && endDate) {
            where.start_time = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        } else if (startDate) {
            where.start_time = { gte: new Date(startDate) };
        } else if (endDate) {
            where.start_time = { lte: new Date(endDate) };
        }

        console.log(`[API] 獲取billing records: page=${page}, limit=${limit}, where=`, where);

        // 獲取總數
        const client = databaseService;
        const allRecords = await client.getBillingRecords(where);
        const total = allRecords.length;

        // 分頁計算
        const skip = (page - 1) * limit;
        const records = allRecords.slice(skip, skip + limit);

        console.log(`✅ [API /api/billing/records] Found ${total} total records, returning ${records.length} records for page ${page}`);

        // 返回標準格式
        const response = NextResponse.json({
            success: true,
            data: records,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            },
            timestamp: new Date().toISOString()
        });

        // 設置快取控制標頭，確保不會被快取
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        return response;

    } catch (error: any) {
        console.error('[API /api/billing/records] 獲取失敗:', error instanceof Error ? error.stack : error);
        return NextResponse.json({
            success: false,
            message: '獲取計費記錄失敗',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
