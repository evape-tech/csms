import { NextRequest, NextResponse } from 'next/server';
import { triggerRebalance } from '../../../lib/ocppCoreClient';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

/**
 * 手動觸發功率重新分配 API 依據參數來判定顆粒度
 * POST /api/trigger-power-reallocation
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[API] 收到手動觸發功率重新分配請求');
        
        // 解析請求體參數
        let requestBody: Record<string, any> = {};
        try {
            requestBody = await request.json();
        } catch {
            console.log('[API] 請求體解析失敗，使用空參數');
        }
        
        const { meter_id, station_id, source = 'frontend-manual-trigger' } = requestBody;
        
        console.log(`[API] 請求參數: meter_id=${meter_id}, station_id=${station_id}, source=${source}`);
        
        // 取得請求來源資訊
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'Unknown';
        
        console.log(`[API] 請求來源: IP=${ip}, UserAgent=${userAgent}`);
        
        const result = await triggerRebalance({
            meterId: meter_id || undefined,
            stationId: station_id || undefined,
            triggerEvent: source,
            eventDetails: {
                userAgent,
                clientIP: ip,
            },
        });
        console.log('[API] ocpp-core 回應:', result);
        
        // 根據請求類型設定回應訊息
        let successMessage: string;
        if (meter_id) {
            successMessage = `已成功觸發電表 ${meter_id} 的功率重新分配`;
        } else if (station_id) {
            successMessage = `已成功觸發站點 ${station_id} 的功率重新分配`;
        } else {
            successMessage = '已成功觸發全站功率重新分配';
        }
        
        const responseData = {
            message: successMessage,
            timestamp: new Date().toISOString(),
            targetType: meter_id ? 'meter' : station_id ? 'station' : 'all',
            targetId: meter_id || station_id || null
        };
        
        return NextResponse.json({
            success: true,
            message: successMessage,
            data: responseData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] 觸發功率重新分配失敗:', error);
        const status = (error as any)?.status && Number.isInteger((error as any).status)
            ? (error as any).status
            : 500;
        
        return NextResponse.json({
            success: false,
            message: '觸發功率重新分配失敗',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status });
    }
}
