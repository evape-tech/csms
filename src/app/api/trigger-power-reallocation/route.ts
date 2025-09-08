import { NextRequest, NextResponse } from 'next/server';

/**
 * 手動觸發全站功率重新分配 API
 * POST /api/trigger-power-reallocation
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[API] 收到手動觸發功率重新分配請求');
        
        // 解析請求體參數
        let requestBody: any = {};
        try {
            requestBody = await request.json();
        } catch (parseError) {
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
        
        // 呼叫 OCPP Server 的手動觸發 API
        const ocppServerUrl = process.env.OCPP_SERVICE_URL || 'http://localhost:8089';
        let triggerUrl: string;
        let triggerBody: any = {
            source: source,
            timestamp: new Date().toISOString(),
            userAgent: userAgent,
            clientIP: ip
        };
        
        // 根據參數決定觸發範圍
        if (meter_id) {
            // 針對特定電表重新分配
            triggerUrl = `${ocppServerUrl}/ocpp/api/trigger_meter_reallocation`;
            triggerBody.meter_id = meter_id;
            console.log(`[API] 針對電表 ${meter_id} 觸發功率重新分配`);
        } else if (station_id) {
            // 針對特定站點重新分配
            triggerUrl = `${ocppServerUrl}/ocpp/api/trigger_station_reallocation`;
            triggerBody.station_id = station_id;
            console.log(`[API] 針對站點 ${station_id} 觸發功率重新分配`);
        } else {
            // 全站重新分配
            triggerUrl = `${ocppServerUrl}/ocpp/api/trigger_profile_update`;
            console.log(`[API] 觸發全站功率重新分配`);
        }
        
        console.log(`[API] 呼叫 OCPP Server: ${triggerUrl}`);
        console.log(`[API] 請求內容:`, JSON.stringify(triggerBody, null, 2));
        
        const response = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CSMS-NextJS-Frontend',
                'X-Forwarded-For': ip,
            },
            body: JSON.stringify(triggerBody)
        });
        
        if (!response.ok) {
            throw new Error(`OCPP Server 回應錯誤: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('[API] OCPP Server 回應:', result);
        
        // 根據請求類型設定回應訊息
        let successMessage: string;
        if (meter_id) {
            successMessage = `已成功觸發電表 ${meter_id} 的功率重新分配`;
        } else if (station_id) {
            successMessage = `已成功觸發站點 ${station_id} 的功率重新分配`;
        } else {
            successMessage = '已成功觸發全站功率重新分配';
        }
        
        // 確保估計完成時間的值正確傳遞到前端
        const responseData = {
            onlineStations: result.onlineStations || 0,
            scheduledUpdates: result.scheduledUpdates || 0,
            estimatedCompletionTime: result.estimatedCompletionTime || `${Math.ceil((result.onlineStations || 0) * 0.1) + 1} 秒`,
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
        
        return NextResponse.json({
            success: false,
            message: '觸發功率重新分配失敗',
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
                '支援針對特定電表重新分配',
                '支援針對特定站點重新分配',
                '支援批量更新所有在線充電樁',
                '智能延遲排程避免衝突',
                '完整的日誌追蹤和錯誤處理'
            ],
            usage: {
                method: 'POST',
                endpoint: '/api/trigger-power-reallocation',
                description: '觸發功率重新分配',
                parameters: {
                    meter_id: '可選 - 針對特定電表重新分配',
                    station_id: '可選 - 針對特定站點重新分配',
                    source: '可選 - 觸發來源標識'
                },
                examples: [
                    '全站重新分配: {}',
                    '電表重新分配: {"meter_id": 123}',
                    '站點重新分配: {"station_id": 456}'
                ]
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
