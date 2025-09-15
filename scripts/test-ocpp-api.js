/**
 * OCPP API 端點測試腳本
 * 專門測試 trigger_meter_reallocation API
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 8089;

// 測試數據
const testData = {
    source: "test-script",
    timestamp: new Date().toISOString(),
    userAgent: "test-script/1.0",
    clientIP: "127.0.0.1",
    meter_id: 1
};

console.log('🧪 測試 OCPP API 端點...');
console.log(`📍 目標: http://${HOST}:${PORT}/ocpp/api/trigger_meter_reallocation`);
console.log(`📊 測試數據: ${JSON.stringify(testData, null, 2)}`);

function testApiEndpoint() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(testData);

        const options = {
            hostname: HOST,
            port: PORT,
            path: '/ocpp/api/trigger_meter_reallocation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'test-script/1.0'
            },
            timeout: 10000
        };

        console.log(`\n🚀 發送請求...`);
        
        const req = http.request(options, (res) => {
            let data = '';
            
            console.log(`📊 狀態碼: ${res.statusCode}`);
            console.log(`📋 回應標頭:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📄 回應內容: ${data}`);
                
                if (res.statusCode === 200) {
                    console.log(`✅ API 測試成功！`);
                    resolve({ success: true, statusCode: res.statusCode, data });
                } else if (res.statusCode === 404) {
                    console.log(`❌ API 端點不存在 (404)`);
                    resolve({ success: false, statusCode: res.statusCode, error: 'API endpoint not found' });
                } else {
                    console.log(`⚠️ API 回應異常 (狀態碼: ${res.statusCode})`);
                    resolve({ success: false, statusCode: res.statusCode, data });
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ 請求失敗: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.log(`💡 服務器未啟動或端口 ${PORT} 不可用`);
            }
            reject(error);
        });

        req.on('timeout', () => {
            console.log(`⏱️ 請求超時`);
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

// 同時測試其他端點進行對比
async function testMultipleEndpoints() {
    const endpoints = [
        { path: '/health', method: 'GET', description: '健康檢查' },
        { path: '/ocpp/api/see_connections', method: 'GET', description: '查看連接' },
        { path: '/ocpp/api/trigger_meter_reallocation', method: 'POST', description: '觸發電表重分配' }
    ];

    console.log(`\n🔍 測試多個端點進行對比...`);
    
    for (const endpoint of endpoints) {
        console.log(`\n📍 測試: ${endpoint.description} (${endpoint.method} ${endpoint.path})`);
        
        try {
            const result = await testEndpoint(endpoint);
            console.log(`   結果: ${result.success ? '✅ 成功' : '❌ 失敗'} (狀態碼: ${result.statusCode})`);
        } catch (error) {
            console.log(`   結果: ❌ 錯誤 - ${error.message}`);
        }
    }
}

function testEndpoint(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: endpoint.path,
            method: endpoint.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'test-script/1.0'
            },
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    statusCode: res.statusCode,
                    data: data.substring(0, 100) // 只保留前100字符
                });
            });
        });

        req.on('error', (error) => reject(error));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        if (endpoint.method === 'POST') {
            const postData = JSON.stringify(testData);
            req.write(postData);
        }
        
        req.end();
    });
}

// 主執行函數
async function main() {
    try {
        console.log('================================================');
        console.log('🧪 OCPP API 端點詳細測試');
        console.log(`📅 測試時間: ${new Date().toLocaleString()}`);
        console.log('================================================');

        // 先測試多個端點進行對比
        await testMultipleEndpoints();

        // 詳細測試目標端點
        console.log(`\n\n🎯 詳細測試目標端點...`);
        const result = await testApiEndpoint();
        
        console.log(`\n================================================`);
        console.log('📋 測試總結');
        console.log('================================================');
        
        if (result.success) {
            console.log(`🎉 測試成功！API 端點正常工作`);
        } else {
            console.log(`⚠️ 測試失敗，需要進一步診斷`);
            
            console.log(`\n💡 可能的原因:`);
            console.log(`   • OCPP Server 路由配置問題`);
            console.log(`   • emsController 模組載入問題`);
            console.log(`   • initializeRoutes() 函數執行問題`);
            console.log(`   • Express 中間件配置問題`);
            
            console.log(`\n🔧 建議的解決步驟:`);
            console.log(`   1. 重啟 OCPP Server: npm run dev:ocpp`);
            console.log(`   2. 檢查服務器啟動日誌是否有錯誤`);
            console.log(`   3. 確認 emsController 模組沒有語法錯誤`);
            console.log(`   4. 檢查 Express 路由註冊是否正確`);
        }
        
    } catch (error) {
        console.error(`❌ 測試過程中發生錯誤: ${error.message}`);
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    main();
}

module.exports = { testApiEndpoint, testMultipleEndpoints };
