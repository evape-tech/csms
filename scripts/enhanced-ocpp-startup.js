/**
 * OCPP Server 啟動增強腳本
 * 確保服務器能在不同環境下正確啟動
 */

const fs = require('fs');
const path = require('path');

// 增強的環境檢查
function checkEnvironment() {
    console.log('🔍 檢查運行環境...');
    
    // 檢查 Node.js 版本
    const nodeVersion = process.version;
    console.log(`📦 Node.js 版本: ${nodeVersion}`);
    
    // 檢查操作系統
    const os = require('os');
    console.log(`💻 操作系統: ${os.platform()} ${os.release()}`);
    console.log(`🏠 主機名: ${os.hostname()}`);
    
    // 檢查網絡接口
    const networkInterfaces = os.networkInterfaces();
    console.log('🌐 可用網絡接口:');
    Object.entries(networkInterfaces).forEach(([name, interfaces]) => {
        interfaces.forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
                console.log(`   ${name}: ${iface.address}`);
            }
        });
    });
    
    // 檢查環境變量
    const requiredEnvVars = ['NODE_ENV'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log(`⚠️ 缺少環境變量: ${missingVars.join(', ')}`);
    }
    
    // 檢查必要文件
    const requiredFiles = [
        'src/servers/ocppServer.js',
        'src/servers/controllers/ocppController.js',
        'src/servers/controllers/emsController.js'
    ];
    
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(process.cwd(), file)));
    
    if (missingFiles.length > 0) {
        console.error(`❌ 缺少必要文件: ${missingFiles.join(', ')}`);
        process.exit(1);
    }
    
    console.log('✅ 環境檢查通過');
}

// 端口衝突檢查和處理
function checkAndHandlePortConflicts() {
    const { execSync } = require('child_process');
    const defaultPort = 8089;
    
    try {
        console.log(`🔍 檢查端口 ${defaultPort} 可用性...`);
        
        // Windows: 檢查端口是否被佔用
        const result = execSync(`netstat -an | findstr :${defaultPort}`, { encoding: 'utf8' });
        
        if (result.trim()) {
            console.log(`⚠️ 端口 ${defaultPort} 已被佔用:`);
            console.log(result.trim());
            
            // 嘗試找到佔用進程
            try {
                const processInfo = execSync(`netstat -ano | findstr :${defaultPort}`, { encoding: 'utf8' });
                console.log('🔍 佔用進程信息:');
                console.log(processInfo.trim());
                
                // 提取 PID
                const pidMatch = processInfo.match(/\s+(\d+)\s*$/m);
                if (pidMatch) {
                    const pid = pidMatch[1];
                    try {
                        const taskInfo = execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf8' });
                        console.log(`📋 進程詳情 (PID: ${pid}):`);
                        console.log(taskInfo);
                    } catch (e) {
                        console.log(`❌ 無法獲取進程詳情 (PID: ${pid})`);
                    }
                }
            } catch (e) {
                console.log('❌ 無法獲取進程詳情');
            }
            
            console.log(`\n💡 建議解決方案:`);
            console.log(`   1. 如果是舊的 OCPP Server 進程，請手動停止`);
            console.log(`   2. 重啟開發環境: Ctrl+C 停止，然後重新運行`);
            console.log(`   3. 或者使用不同端口: set OCPP_PORT=8090 && npm run dev:ocpp`);
            
            return false;
        } else {
            console.log(`✅ 端口 ${defaultPort} 可用`);
            return true;
        }
    } catch (error) {
        console.log(`✅ 端口 ${defaultPort} 似乎可用 (檢查命令失敗，但這通常表示端口未被佔用)`);
        return true;
    }
}

// 增強的錯誤處理
function setupErrorHandling() {
    process.on('uncaughtException', (error) => {
        console.error('❌ 未捕獲的異常:', error);
        console.error('📍 錯誤堆棧:', error.stack);
        
        // 記錄到文件
        const errorLog = `[${new Date().toISOString()}] 未捕獲異常: ${error.message}\n${error.stack}\n\n`;
        fs.appendFileSync(path.join(process.cwd(), 'logs', 'error.log'), errorLog);
        
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ 未處理的 Promise 拒絕:', reason);
        console.error('📍 Promise:', promise);
        
        // 記錄到文件
        const errorLog = `[${new Date().toISOString()}] 未處理的Promise拒絕: ${reason}\n\n`;
        fs.appendFileSync(path.join(process.cwd(), 'logs', 'error.log'), errorLog);
    });
    
    // 確保日誌目錄存在
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

// 啟動前置檢查
function preStartupChecks() {
    console.log('🚀 OCPP Server 啟動前置檢查...');
    console.log('================================================');
    
    checkEnvironment();
    
    const portAvailable = checkAndHandlePortConflicts();
    if (!portAvailable) {
        console.log('\n❌ 端口衝突，無法啟動 OCPP Server');
        console.log('請解決端口衝突後重新嘗試');
        process.exit(1);
    }
    
    setupErrorHandling();
    
    console.log('✅ 所有前置檢查通過');
    console.log('================================================\n');
}

// 啟動 OCPP Server
function startOcppServer() {
    preStartupChecks();
    
    console.log('🔥 正在啟動 OCPP Server...');
    
    // 設置環境變量
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    
    // 啟動服務器
    require('../src/servers/ocppServer');
}

// 如果直接執行此腳本
if (require.main === module) {
    startOcppServer();
}

module.exports = {
    checkEnvironment,
    checkAndHandlePortConflicts,
    setupErrorHandling,
    preStartupChecks,
    startOcppServer
};
