/**
 * 完整的 OCPP Server 診斷腳本
 * 模擬前端請求，確保在充電站現場也能正常工作
 */

require('dotenv').config();
const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

console.log('🔧 OCPP Server 完整診斷開始...');
console.log('================================================');

// 1. 環境檢查
function checkEnvironment() {
    console.log('\n📋 環境資訊:');
    console.log(`   • 操作系統: ${os.platform()} ${os.release()}`);
    console.log(`   • Node.js 版本: ${process.version}`);
    console.log(`   • 主機名: ${os.hostname()}`);
    
    // 檢查環境變量
    const envVars = [
        'OCPP_SERVICE_URL',
        'OCPP_PORT',
        'OCPP_HOST',
        'NODE_ENV'
    ];
    
    console.log('\n🔧 環境變量:');
    envVars.forEach(varName => {
        const value = process.env[varName];
        console.log(`   • ${varName}: ${value || '(未設定)'}`);
    });
    
    // 檢查網絡接口
    console.log('\n🌐 網絡接口:');
    const networkInterfaces = os.networkInterfaces();
    Object.entries(networkInterfaces).forEach(([name, interfaces]) => {
        interfaces.forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
                console.log(`   • ${name}: ${iface.address}`);
            }
        });
    });
}

// 2. DNS 解析檢查
function checkDnsResolution() {
    console.log('\n🔍 DNS 解析檢查:');
    
    const hosts = ['localhost', '127.0.0.1'];
    
    hosts.forEach(host => {
        try {
            // 嘗試解析主機名
            const { execSync } = require('child_process');
            const result = execSync(`nslookup ${host}`, { encoding: 'utf8', timeout: 5000 });
            console.log(`   • ${host}: ✅ 解析成功`);
        } catch (error) {
            console.log(`   • ${host}: ❌ 解析失敗 - ${error.message}`);
        }
    });
}

// 3. 防火牆檢查
function checkFirewall() {
    console.log('\n🔒 防火牆檢查:');
    
    try {
        // Windows 防火牆檢查
        const result = execSync('netsh advfirewall show allprofiles state', { encoding: 'utf8' });
        console.log('   • Windows 防火牆狀態:');
        
        const profiles = result.split('\n').filter(line => line.includes('State'));
        profiles.forEach(profile => {
            console.log(`     ${profile.trim()}`);
        });
        
    } catch (error) {
        console.log(`   • 無法檢查防火牆狀態: ${error.message}`);
    }
}

// 4. 端口連接測試
function testPortConnectivity(host, port) {
    return new Promise((resolve) => {
        const socket = new (require('net').Socket)();
        const timeout = 3000;
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve({ success: true, message: '連接成功' });
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ success: false, message: '連接超時' });
        });
        
        socket.on('error', (error) => {
            socket.destroy();
            resolve({ success: false, message: error.message });
        });
        
        socket.connect(port, host);
    });
}

// 5. 模擬前端請求
function simulateFrontendRequest() {
    return new Promise((resolve) => {
        console.log('\n🎭 模擬前端請求...');
        
        const postData = JSON.stringify({
            source: "frontend-meter-manual-trigger",
            timestamp: new Date().toISOString(),
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
            clientIP: "::1",
            meter_id: 1
        });

        const options = {
            hostname: 'localhost',
            port: 8089,
            path: '/ocpp/api/trigger_meter_reallocation',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'CSMS-NextJS-Frontend',
                'X-Forwarded-For': '::1',
            },
            timeout: 10000
        };

        console.log('   📊 請求詳情:');
        console.log(`   • URL: http://${options.hostname}:${options.port}${options.path}`);
        console.log(`   • 方法: ${options.method}`);
        console.log(`   • 標頭: ${JSON.stringify(options.headers, null, 6)}`);
        console.log(`   • 請求體: ${postData}`);

        const req = http.request(options, (res) => {
            let data = '';
            
            console.log(`\n   📈 回應狀態: ${res.statusCode}`);
            console.log(`   📋 回應標頭: ${JSON.stringify(res.headers, null, 6)}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`   📄 回應內容: ${data}`);
                
                resolve({
                    success: res.statusCode === 200,
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ 請求錯誤: ${error.message}`);
            resolve({ success: false, error: error.message });
        });

        req.on('timeout', () => {
            console.log(`   ⏱️ 請求超時`);
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.write(postData);
        req.end();
    });
}

// 6. 工廠環境模擬測試
async function simulateFactoryEnvironment() {
    console.log('\n🏭 模擬工廠環境測試...');
    
    // 測試不同的網絡配置
    const testConfigs = [
        { host: 'localhost', port: 8089, description: '本地環回' },
        { host: '127.0.0.1', port: 8089, description: 'IP 環回' },
        { host: '0.0.0.0', port: 8089, description: '所有接口 (如果服務器綁定到 0.0.0.0)' }
    ];
    
    for (const config of testConfigs) {
        console.log(`\n   🔌 測試配置: ${config.description}`);
        console.log(`   📍 地址: ${config.host}:${config.port}`);
        
        const result = await testPortConnectivity(config.host, config.port);
        console.log(`   結果: ${result.success ? '✅ 成功' : '❌ 失敗'} - ${result.message}`);
    }
}

// 7. 網絡延遲測試
function testNetworkLatency() {
    return new Promise((resolve) => {
        console.log('\n⚡ 網絡延遲測試...');
        
        const start = Date.now();
        
        const req = http.request({
            hostname: 'localhost',
            port: 8089,
            path: '/health',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            const latency = Date.now() - start;
            console.log(`   📊 延遲: ${latency}ms`);
            resolve({ latency, success: true });
        });

        req.on('error', (error) => {
            const latency = Date.now() - start;
            console.log(`   ❌ 測試失敗: ${error.message} (耗時: ${latency}ms)`);
            resolve({ latency, success: false, error: error.message });
        });

        req.end();
    });
}

// 主診斷函數
async function runCompleteDiagnosis() {
    try {
        console.log('\n🩺 開始完整診斷...');
        console.log(`📅 診斷時間: ${new Date().toLocaleString()}`);
        
        // 1. 環境檢查
        checkEnvironment();
        
        // 2. DNS 檢查
        checkDnsResolution();
        
        // 3. 防火牆檢查
        checkFirewall();
        
        // 4. 工廠環境模擬
        await simulateFactoryEnvironment();
        
        // 5. 網絡延遲測試
        await testNetworkLatency();
        
        // 6. 模擬前端請求
        const frontendResult = await simulateFrontendRequest();
        
        // 結果總結
        console.log('\n================================================');
        console.log('📋 診斷結果總結');
        console.log('================================================');
        
        if (frontendResult.success) {
            console.log('🎉 所有測試通過！OCPP Server 在當前環境下工作正常');
            
            console.log('\n🔧 為確保在工廠環境下也能正常工作，建議:');
            console.log('   1. 確保工廠網絡允許 8089 端口通信');
            console.log('   2. 檢查工廠防火牆設定');
            console.log('   3. 考慮將服務器綁定到 0.0.0.0 而非 localhost');
            console.log('   4. 在工廠環境測試網絡連通性');
            
        } else {
            console.log('⚠️ 檢測到問題，需要進一步排查');
            
            console.log('\n🔧 故障排除步驟:');
            console.log('   1. 重啟 OCPP Server');
            console.log('   2. 檢查端口是否被其他程序佔用');
            console.log('   3. 檢查防火牆設定');
            console.log('   4. 驗證網絡配置');
        }
        
        // 提供工廠環境配置建議
        console.log('\n🏭 工廠環境配置建議:');
        console.log('   • 使用靜態 IP 地址');
        console.log('   • 配置防火牆允許必要端口');
        console.log('   • 設定服務器綁定到所有網絡接口 (0.0.0.0)');
        console.log('   • 使用 PM2 或類似工具確保服務穩定運行');
        console.log('   • 設定服務自動重啟機制');
        
    } catch (error) {
        console.error(`❌ 診斷過程中發生錯誤: ${error.message}`);
        console.error(error.stack);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runCompleteDiagnosis();
}

module.exports = {
    runCompleteDiagnosis,
    simulateFrontendRequest,
    testPortConnectivity,
    checkEnvironment
};
