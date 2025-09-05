import { NextRequest, NextResponse } from 'next/server';

/**
 * 手動觸發全站功率重新分配 API
 * POST /api/trigger-power-reallocation
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[API] 收到手動觸發全站功率重新分配請求');
        
        // 取得請求來源資訊
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const ip = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'Unknown';
        
        console.log(`[API] 請求來源: IP=${ip}, UserAgent=${userAgent}`);
        
        // 呼叫 OCPP Server 的手動觸發 API
        const ocppServerUrl = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
        const triggerUrl = `${ocppServerUrl}/ocpp/api/trigger_profile_update`;
        
        console.log(`[API] 呼叫 OCPP Server: ${triggerUrl}`);
        
        const response = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CSMS-NextJS-Frontend',
                'X-Forwarded-For': ip,
            },
            // 可以傳遞額外的觸發參數
            body: JSON.stringify({
                source: 'frontend-manual-trigger',
                timestamp: new Date().toISOString(),
                userAgent: userAgent,
                clientIP: ip
            })
        });
        
        if (!response.ok) {
            throw new Error(`OCPP Server 回應錯誤: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('[API] OCPP Server 回應:', result);
        
        // 確保估計完成時間的值正確傳遞到前端
        const responseData = {
            onlineStations: result.onlineStations || 0,
            scheduledUpdates: result.scheduledUpdates || 0,
            estimatedCompletionTime: result.estimatedCompletionTime || `${Math.ceil((result.onlineStations || 0) * 0.1) + 1} 秒`
        };
        
        return NextResponse.json({
            success: true,
            message: '已成功觸發全站功率重新分配',
            data: responseData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] 觸發全站功率重新分配失敗:', error);
        
        return NextResponse.json({
            success: false,
            message: '觸發全站功率重新分配失敗',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

/**
 * 取得功率重新分配狀態 API (可選)
 * GET /api/trigger-power-reallocation
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[API] 收到功率重新分配狀態查詢請求');
        
        // 這裡可以回傳當前的重新分配狀態或統計資訊
        return NextResponse.json({
            success: true,
            message: '功率重新分配 API 運作正常',
            features: [
                '手動觸發全站功率重新分配',
                '支援批量更新所有在線充電樁',
                '智能延遲排程避免衝突',
                '完整的日誌追蹤和錯誤處理'
            ],
            usage: {
                method: 'POST',
                endpoint: '/api/trigger-power-reallocation',
                description: '觸發全站功率重新分配'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] 查詢功率重新分配狀態失敗:', error);
        
        return NextResponse.json({
            success: false,
            message: '查詢功率重新分配狀態失敗',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
