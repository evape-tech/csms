/**
 * OCPP Server 健康檢查腳本
 * 用於確認 OCPP Server 是否正確啟動並監聽正確的端口
 */

const http = require('http');
const { execSync } = require('child_process');

// 預設配置
const OCPP_HOST = process.env.OCPP_HOST || 'localhost';
const OCPP_PORT = process.env.OCPP_PORT || 8089;
const CHECK_TIMEOUT = 5000; // 5秒超時

console.log(`🔍 檢查 OCPP Server 狀態...`);
console.log(`📍 目標地址: http://${OCPP_HOST}:${OCPP_PORT}`);
console.log(`⏱️ 超時時間: ${CHECK_TIMEOUT}ms`);

// 1. 檢查端口是否被佔用
function checkPortInUse() {
    try {
        console.log(`\n🔍 檢查端口 ${OCPP_PORT} 是否被使用...`);
        
        // Windows: netstat 命令
        const result = execSync(`netstat -an | findstr :${OCPP_PORT}`, { encoding: 'utf8' });
        
        if (result.trim()) {
            console.log(`✅ 端口 ${OCPP_PORT} 正在被使用:`);
            console.log(result.trim());
            return true;
        } else {
            console.log(`❌ 端口 ${OCPP_PORT} 沒有被使用`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 無法檢查端口狀態: ${error.message}`);
        return false;
    }
}

// 2. 檢查 HTTP 健康檢查端點
function checkHealthEndpoint() {
    return new Promise((resolve) => {
        console.log(`\n🩺 檢查健康檢查端點: http://${OCPP_HOST}:${OCPP_PORT}/health`);
        
        const req = http.request({
            hostname: OCPP_HOST,
            port: OCPP_PORT,
            path: '/health',
            method: 'GET',
            timeout: CHECK_TIMEOUT
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ 健康檢查通過 (狀態碼: ${res.statusCode})`);
                    console.log(`📄 回應內容: ${data}`);
                    resolve(true);
                } else {
                    console.log(`⚠️ 健康檢查異常 (狀態碼: ${res.statusCode})`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ 健康檢查失敗: ${error.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(`⏱️ 健康檢查超時`);
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// 3. 檢查 OCPP API 端點
function checkOcppApiEndpoint() {
    return new Promise((resolve) => {
        console.log(`\n🔌 檢查 OCPP API 端點: http://${OCPP_HOST}:${OCPP_PORT}/ocpp/api/v1/trigger_meter_reallocation`);
        
        const postData = JSON.stringify({
            source: "health-check",
            timestamp: new Date().toISOString(),
            meter_id: 999 // 測試用的電表ID
        });

        const req = http.request({
            hostname: OCPP_HOST,
            port: OCPP_PORT,
            path: '/ocpp/api/v1/trigger_meter_reallocation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: CHECK_TIMEOUT
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`📊 API 端點回應 (狀態碼: ${res.statusCode})`);
                if (res.statusCode === 404) {
                    console.log(`❌ API 端點不存在 (404 Not Found)`);
                    resolve(false);
                } else if (res.statusCode >= 200 && res.statusCode < 500) {
                    console.log(`✅ API 端點存在且可訪問`);
                    console.log(`📄 回應內容: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
                    resolve(true);
                } else {
                    console.log(`⚠️ API 端點異常回應`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ API 端點檢查失敗: ${error.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(`⏱️ API 端點檢查超時`);
            req.destroy();
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

// 4. 檢查網絡連接性
function checkNetworkConnectivity() {
    return new Promise((resolve) => {
        console.log(`\n🌐 檢查網絡連接性...`);
        
        const req = http.request({
            hostname: OCPP_HOST,
            port: OCPP_PORT,
            path: '/',
            method: 'GET',
            timeout: CHECK_TIMEOUT
        }, (res) => {
            console.log(`✅ 網絡連接正常 (狀態碼: ${res.statusCode})`);
            resolve(true);
        });

        req.on('error', (error) => {
            if (error.code === 'ECONNREFUSED') {
                console.log(`❌ 連接被拒絕 - OCPP Server 可能未啟動`);
            } else if (error.code === 'ENOTFOUND') {
                console.log(`❌ 主機名解析失敗 - 請檢查主機名`);
            } else {
                console.log(`❌ 網絡連接失敗: ${error.message}`);
            }
            resolve(false);
        });

        req.on('timeout', () => {
            console.log(`⏱️ 網絡連接超時`);
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// 主要檢查流程
async function runHealthCheck() {
    console.log(`\n================================================`);
    console.log(`🏥 OCPP Server 健康檢查開始`);
    console.log(`📅 檢查時間: ${new Date().toLocaleString()}`);
    console.log(`================================================\n`);

    const results = {
        portInUse: false,
        networkConnectivity: false,
        healthEndpoint: false,
        ocppApiEndpoint: false
    };

    // 執行所有檢查
    results.portInUse = checkPortInUse();
    results.networkConnectivity = await checkNetworkConnectivity();
    
    if (results.networkConnectivity) {
        results.healthEndpoint = await checkHealthEndpoint();
        results.ocppApiEndpoint = await checkOcppApiEndpoint();
    }

    // 輸出總結
    console.log(`\n================================================`);
    console.log(`📋 檢查結果總結`);
    console.log(`================================================`);
    console.log(`🔌 端口佔用檢查: ${results.portInUse ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🌐 網絡連接檢查: ${results.networkConnectivity ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🩺 健康檢查端點: ${results.healthEndpoint ? '✅ 通過' : '❌ 失敗'}`);
    console.log(`🔌 OCPP API端點: ${results.ocppApiEndpoint ? '✅ 通過' : '❌ 失敗'}`);

    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log(`\n🎉 所有檢查通過！OCPP Server 運行正常`);
        process.exit(0);
    } else {
        console.log(`\n⚠️ 部分檢查失敗，請檢查 OCPP Server 狀態`);
        
        // 提供建議
        console.log(`\n💡 建議的解決方案:`);
        if (!results.portInUse) {
            console.log(`   • 啟動 OCPP Server: npm run dev:ocpp`);
            console.log(`   • 或使用完整啟動: npm run dev:all`);
        }
        if (!results.networkConnectivity) {
            console.log(`   • 檢查防火牆設定`);
            console.log(`   • 確認端口 ${OCPP_PORT} 沒有被其他程序佔用`);
        }
        if (!results.ocppApiEndpoint) {
            console.log(`   • 檢查 OCPP Server 路由設定`);
            console.log(`   • 確認 emsController 模組正確載入`);
        }
        
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runHealthCheck().catch(error => {
        console.error(`❌ 健康檢查過程中發生錯誤: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    runHealthCheck,
    checkPortInUse,
    checkNetworkConnectivity,
    checkHealthEndpoint,
    checkOcppApiEndpoint
};
