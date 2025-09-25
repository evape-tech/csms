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

        console.log(`🔍 [API /api/billing/statistics] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
        
        // 確保資料庫已初始化
        await DatabaseUtils.initialize(process.env.DB_PROVIDER);

        // 構建過濾條件
        const where: any = {};
        
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
        
        if (cpid) where.cpid = cpid;
        if (status) where.status = status;

        // 獲取計費記錄
        const records = await databaseService.getBillingRecords(where);

        // 計算統計信息
        const totalRecords = records.length;
        const totalAmount = records.reduce((sum: number, record: any) => sum + parseFloat(record.total_amount || 0), 0);
        const totalEnergyConsumed = records.reduce((sum: number, record: any) => sum + parseFloat(record.energy_consumed || 0), 0);
        const totalEnergyFee = records.reduce((sum: number, record: any) => sum + parseFloat(record.energy_fee || 0), 0);
        const totalDiscountAmount = records.reduce((sum: number, record: any) => sum + parseFloat(record.discount_amount || 0), 0);

        // 按狀態分組統計
        const statusStats: any = {};
        records.forEach((record: any) => {
            const recordStatus = record.status || 'UNKNOWN';
            if (!statusStats[recordStatus]) {
                statusStats[recordStatus] = { count: 0, amount: 0 };
            }
            statusStats[recordStatus].count++;
            statusStats[recordStatus].amount += parseFloat(record.total_amount || 0);
        });

        const result = {
            success: true,
            data: {
                totalRecords,
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                totalEnergyConsumed: parseFloat(totalEnergyConsumed.toFixed(2)),
                totalEnergyFee: parseFloat(totalEnergyFee.toFixed(2)),
                totalDiscountAmount: parseFloat(totalDiscountAmount.toFixed(2)),
                averageAmount: totalRecords > 0 ? parseFloat((totalAmount / totalRecords).toFixed(2)) : 0,
                averageEnergyConsumed: totalRecords > 0 ? parseFloat((totalEnergyConsumed / totalRecords).toFixed(2)) : 0,
                statusStats
            },
            timestamp: new Date().toISOString()
        };

        console.log(`✅ [API /api/billing/statistics] 統計 ${totalRecords} 筆記錄`);
        
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
