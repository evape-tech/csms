// 使用新的Prisma數據庫適配器 - 使用動態 import
let DatabaseUtils;
let databaseService;
let createCpLog;

// 引入 EMS 分配演算法
const { calculateEmsAllocation } = require('../lib/emsAllocator');

// 動態載入 ES6 modules
const loadDatabaseModules = async () => {
  if (!DatabaseUtils) {
    const utilsModule = await import('../lib/database/utils.js');
    const serviceModule = await import('../lib/database/service.js');
    DatabaseUtils = utilsModule.default;
    databaseService = serviceModule.databaseService;
    createCpLog = databaseService.createCpLog;
  }
  return { DatabaseUtils, databaseService, createCpLog };
};

// Initialize database connection
let isDbInitialized = false;

const initializeDatabase = async () => {
  try {
    console.log('🔄 OCPP Controller: Initializing database...');
    console.log(`🔍 [Environment] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    console.log(`🔍 [Environment] DATABASE_URL = "${process.env.DATABASE_URL?.substring(0, 20)}..."`);
    console.log(`🔍 [Environment] DATABASE_URL_MSSQL = "${process.env.DATABASE_URL_MSSQL?.substring(0, 20)}..."`);
    
    // 載入資料庫模組
    const { DatabaseUtils: dbUtils } = await loadDatabaseModules();
    
    // 初始化數據庫連接，明確指定 provider
    const targetProvider = process.env.DB_PROVIDER || 'mysql';
    console.log(`🎯 [OCPP] Target database provider: ${targetProvider}`);
    const initialized = await dbUtils.initialize(targetProvider);
    
    if (initialized) {
      isDbInitialized = true;
      console.log('✅ OCPP Controller: Database initialized successfully with Prisma');
      console.log(`📊 Current provider: ${dbUtils.getCurrentProvider()?.toUpperCase()}`);
      
      // 執行數據庫健康檢查
      const isHealthy = await dbUtils.healthCheck();
      console.log(`💚 Database health: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
      
    } else {
      console.error('❌ OCPP Controller: Failed to initialize database');
    }
    
  } catch (err) {
    console.error('💥 OCPP Controller: Database initialization error', err);
    isDbInitialized = false;
  }
};

// Initialize database when the module loads
initializeDatabase();

// =================================
// 數據庫操作輔助函數 (Prisma 適配)
// =================================

// 確保數據庫已初始化的檢查函數
async function ensureDbInitialized() {
  if (!isDbInitialized) {
    console.log('⚠️  Database not initialized, attempting to initialize...');
    await initializeDatabase();
  }
  
  if (!isDbInitialized) {
    throw new Error('Database initialization failed');
  }
}

// Gun 相關操作
async function findAllGuns(whereClause = {}) {
  await ensureDbInitialized();
  const { databaseService: dbService } = await loadDatabaseModules();
  return await dbService.getGuns(whereClause);
}

async function updateGun(whereClause, updateData) {
  await ensureDbInitialized();
  
  // Prisma 需要先找到目標記錄，然後更新
  const { databaseService: dbService } = await loadDatabaseModules();
  const guns = await dbService.getGuns(whereClause);
  
  if (guns.length === 0) {
    return [0]; // 返回格式類似 Sequelize
  }
  
  // 批量更新所有匹配的記錄
  const updatePromises = guns.map(gun => 
    dbService.updateGun(gun.id, {
      ...updateData,
      updatedAt: new Date()
    })
  );
  
  await Promise.all(updatePromises);
  return [guns.length]; // 返回更新數量
}

// =================================
// 原有的 OCPP 控制邏輯
// =================================

const axios = require('axios')

const wsClients = {}
const wsCpdatas={}

// 事件驅動功率管理相關變數
const profileUpdateTimers = {};              // 存儲每個 cpid 的防抖定時器
const lastProfileUpdateTime = {};            // 記錄每個 cpid 的最後更新時間
const PROFILE_UPDATE_DEBOUNCE_MS = 3000;     // 3秒防抖延遲，避免短時間內重複觸發
const PROFILE_MIN_INTERVAL_MS = 30000;       // 30秒最小間隔，防止過度頻繁更新
const RECONCILE_INTERVAL_MS = 60000;         // 60秒定時校正間隔，容錯補償機制

/**
 * 定時全域功率配置校正機制
 * 每 60 秒執行一次全站功率配置檢查和更新
 * 主要功能：
 * 1. 容錯補償：防止 WebSocket 斷線或事件遺失導致的配置不同步
 * 2. 全局一致性：確保所有在線充電樁都有正確的功率配置
 * 3. 自動恢復：定期重新評估和調整功率分配
 */
setInterval(async () => {
    try {
        console.log('='.repeat(60));
        console.log('[reconciliation] 🔄 開始定時功率配置校正');
        console.log(`[reconciliation] ⏰ 校正間隔: ${RECONCILE_INTERVAL_MS/1000} 秒`);
        
        // 獲取當前在線的充電樁清單
        const onlineCpids = await getOnlineCpids();
        console.log(`[reconciliation] 📊 線上充電樁統計: ${onlineCpids.length} 個`);
        console.log(`[reconciliation] 📋 線上清單: [${onlineCpids.join(', ')}]`);
        
        // 如果沒有在線充電樁，跳過校正
        if (onlineCpids.length === 0) {
            console.log('[reconciliation] ⚠️  無線上充電樁，跳過此次校正');
            console.log('='.repeat(60));
            return;
        }
        
        let totalScheduledUpdates = 0;
        
        // 批量處理每個在線充電樁的配置更新
        console.log('[reconciliation] 🚀 開始批量排程功率配置更新...');
        
        for (let i = 0; i < onlineCpids.length; i++) {
            const cpid = onlineCpids[i];
            console.log(`[reconciliation] 處理充電樁 ${i+1}/${onlineCpids.length}: CPID ${cpid}`);
            
            // 直接使用 CPID 排程更新，無需再查找映射
            // 使用隨機延遲避免同時下發，分散服務器負載
            const delay = Math.random() * 5000;  // 0-5秒隨機延遲
            console.log(`[reconciliation] ✅ 排程更新 ${cpid}，延遲 ${Math.round(delay)}ms`);
            scheduleProfileUpdate(cpid, delay);
            totalScheduledUpdates++;
        }
        
        console.log(`[reconciliation] 📈 校正統計:`);
        console.log(`[reconciliation]   - 掃描充電站: ${onlineCpids.length} 個`);
        console.log(`[reconciliation]   - 排程更新: ${totalScheduledUpdates} 個`);
        console.log(`[reconciliation] ✨ 定時校正完成，下次校正將在 ${RECONCILE_INTERVAL_MS/1000} 秒後執行`);
        console.log('='.repeat(60));
        
        // 如果有排程更新，延遲顯示全站功率配置總覽
        if (totalScheduledUpdates > 0) {
            const totalDelay = Math.max(5000, totalScheduledUpdates * 500); // 至少等待5秒，或按更新數量計算
            console.log(`[reconciliation] 📊 將在 ${totalDelay}ms 後顯示全站功率配置總覽`);
            
            setTimeout(async () => {
                try {
                    const siteSetting = await getSiteSetting();
                    await logCurrentPowerConfiguration(siteSetting.ems_mode, parseFloat(siteSetting.max_power_kw));
                } catch (error) {
                    console.error('❌ [reconciliation] 顯示功率總覽時發生錯誤:', error);
                }
            }, totalDelay);
        }
        
    } catch (error) {
        console.error('❌ [reconciliation] 定時校正過程中發生嚴重錯誤:');
        console.error('[reconciliation] 錯誤訊息:', error.message);
        console.error('[reconciliation] 錯誤堆疊:', error.stack);
        console.log('[reconciliation] 🔄 系統將在下個周期重試校正');
        console.log('='.repeat(60));
    }
}, RECONCILE_INTERVAL_MS);

/**
 * 更新充電站上線狀態
 * 當 WebSocket 連線建立時，將該充電站下所有充電樁狀態設為可用
 * @param {string} cpsn 充電站序號
 */
async function updateStationOnlineStatus(cpsn) {
    try {
        console.log(`[updateStationOnlineStatus] 🔄 開始更新充電站 ${cpsn} 的上線狀態`);
        
        // 查找該充電站下的所有充電樁
        const guns = await findAllGuns({ cpsn });
        
        if (guns.length === 0) {
            console.log(`[updateStationOnlineStatus] ⚠️  未找到充電站 ${cpsn} 的充電樁記錄`);
            return;
        }
        
        console.log(`[updateStationOnlineStatus] 📊 找到 ${guns.length} 個充電樁需要更新狀態`);
        
        // 批量更新所有充電樁狀態為 Available (可用)
        const updateResult = await updateGun(
            { cpsn },
            { 
                guns_status: 'Available'
                // 可選：記錄上線時間
                // updated_at: new Date()
            }
        );
        
        console.log(`[updateStationOnlineStatus] ✅ 成功更新 ${updateResult[0]} 個充電樁狀態為 Available`);
        
        // 記錄每個充電樁的狀態變更
        guns.forEach(async gun => {
            console.log(`[updateStationOnlineStatus] 📍 CPID:${gun.cpid} | 連接器:${gun.connector} | 狀態: ${gun.guns_status} -> Available`);
        });
        
        // 充電站上線後，觸發功率重新分配
        console.log(`[updateStationOnlineStatus] 🔋 充電站 ${cpsn} 上線，觸發功率重新分配`);
        
        // 延遲觸發功率配置更新，確保連線穩定
        setTimeout(async () => {
            console.log(`[updateStationOnlineStatus] 🚀 為新上線充電站 ${cpsn} 配置功率`);
            
            // 為新上線充電站的所有 connector 排程功率配置
            guns.forEach((gun, index) => {
                const delay = index * 500; // 每個 connector 間隔500ms
                console.log(`[updateStationOnlineStatus] ⚡ 排程 ${gun.cpid} 功率配置，延遲 ${delay}ms`);
                scheduleProfileUpdate(gun.cpid, delay);
            });
            
            // 同時觸發其他在線充電樁重新分配（因為總在線數量改變）
            const onlineCpids = await getOnlineCpids();
            
            // 獲取當前充電站的 CPID，以便從在線列表中排除
            const currentStationCpids = guns.map(gun => gun.cpid);
            const otherOnlineCpids = onlineCpids.filter(cpid => !currentStationCpids.includes(cpid));
            
            if (otherOnlineCpids.length > 0) {
                console.log(`[updateStationOnlineStatus] 🔄 同時更新其他 ${otherOnlineCpids.length} 個在線充電樁功率配置`);
                
                // 為其他在線充電樁排程功率配置更新
                otherOnlineCpids.forEach((cpid, index) => {
                    const baseDelay = guns.length * 500 + 1000; // 等新充電站配置完成後
                    const delay = baseDelay + index * 500; // 每個充電樁間隔500ms
                    console.log(`[updateStationOnlineStatus] ⚡ 排程其他充電樁 ${cpid} 功率配置，延遲 ${delay}ms`);
                    scheduleProfileUpdate(cpid, delay);
                });
            }
            
        }, 3000); // 延遲3秒執行，確保連線穩定
        
    } catch (error) {
        console.error(`[updateStationOnlineStatus] ❌ 更新充電站 ${cpsn} 上線狀態時發生錯誤:`);
        console.error('[updateStationOnlineStatus] 錯誤訊息:', error.message);
        console.error('[updateStationOnlineStatus] 錯誤堆疊:', error.stack);
    }
}

/**
 * 更新充電站離線狀態
 * 當 WebSocket 連線完全斷開時，將該充電站下所有充電樁狀態設為離線
 * @param {string} cpsn 充電站序號
 */
async function updateStationOfflineStatus(cpsn) {
    try {
        console.log(`[updateStationOfflineStatus] 🔄 開始更新充電站 ${cpsn} 的離線狀態`);
        
        // 查找該充電站下的所有充電樁
        const guns = await findAllGuns({ cpsn });
        
        if (guns.length === 0) {
            console.log(`[updateStationOfflineStatus] ⚠️  未找到充電站 ${cpsn} 的充電樁記錄`);
            return;
        }
        
        console.log(`[updateStationOfflineStatus] 📊 找到 ${guns.length} 個充電樁需要更新狀態`);
        
        // 批量更新所有充電樁狀態為 Unavailable (離線)
        const updateResult = await updateGun(
            { cpsn },
            { 
                guns_status: 'Unavailable',
                // 可選：記錄離線時間
                // updated_at: new Date()
            }
        );
        
        console.log(`[updateStationOfflineStatus] ✅ 成功更新 ${updateResult[0]} 個充電樁狀態為 Unavailable`);
        
        // 記錄每個充電樁的狀態變更
        guns.forEach(async gun => {
            console.log(`[updateStationOfflineStatus] 📍 CPID:${gun.cpid} | 連接器:${gun.connector} | 狀態: ${gun.guns_status} -> Unavailable`);
        });
        
        // 如果充電站斷線，也需要觸發功率重新分配
        console.log(`[updateStationOfflineStatus] 🔋 充電站 ${cpsn} 離線，觸發其他在線充電樁功率重新分配`);
        
        // 獲取剩餘在線充電樁並觸發功率配置更新
        const onlineCpids = await getOnlineCpids();
        console.log(`[updateStationOfflineStatus] 📊 剩餘在線充電站: ${onlineCpids.length} 個`);
        
        if (onlineCpids.length > 0) {
            // 延遲觸發功率重新分配，避免與斷線處理衝突
            setTimeout(() => {
                console.log(`[updateStationOfflineStatus] 🚀 開始為剩餘 ${onlineCpids.length} 個在線充電站重新分配功率`);
                
                onlineCpids.forEach((remainingCpsn, index) => {
                    // 查找 connector 1 和 2 的 cpid
                    const cpid1 = getCpidFromWsData(remainingCpsn, 1);
                    const cpid2 = getCpidFromWsData(remainingCpsn, 2);
                    
                    const delay = index * 1000; // 每個充電站間隔1秒更新
                    
                    if (cpid1) {
                        console.log(`[updateStationOfflineStatus] ⚡ 排程 ${cpid1} 功率重新分配，延遲 ${delay}ms`);
                        scheduleProfileUpdate(cpid1, delay);
                    }
                    
                    if (cpid2) {
                        console.log(`[updateStationOfflineStatus] ⚡ 排程 ${cpid2} 功率重新分配，延遲 ${delay + 500}ms`);
                        scheduleProfileUpdate(cpid2, delay + 500);
                    }
                });
            }, 2000); // 延遲2秒執行，確保斷線處理完成
        } else {
            console.log(`[updateStationOfflineStatus] ℹ️  無其他在線充電站，無需重新分配功率`);
        }
        
    } catch (error) {
        console.error(`[updateStationOfflineStatus] ❌ 更新充電站 ${cpsn} 離線狀態時發生錯誤:`);
        console.error('[updateStationOfflineStatus] 錯誤訊息:', error.message);
        console.error('[updateStationOfflineStatus] 錯誤堆疊:', error.stack);
    }
}

// helper: 回傳目前在線的 cpid 陣列
async function getOnlineCpids() {
  try {
    console.log('[getOnlineCpids] 檢查在線充電樁...');
    console.log('[getOnlineCpids] wsClients 物件狀態:', Object.keys(wsClients).length > 0 ? Object.keys(wsClients) : '空物件');
    
    // 調試：顯示 wsClients 的詳細結構
    Object.keys(wsClients).forEach(key => {
      const clients = wsClients[key];
      console.log(`[getOnlineCpids] wsClients[${key}]: ${Array.isArray(clients) ? clients.length : 'not array'} 個連接`);
    });
    
    // 獲取在線的 CPSN（設備序號）
    const onlineCSPNs = Object.keys(wsClients).filter(k => Array.isArray(wsClients[k]) && wsClients[k].length > 0);
    console.log(`[getOnlineCpids] 找到 ${onlineCSPNs.length} 個在線設備序號 (CPSN): [${onlineCSPNs.join(', ')}]`);
    
    if (onlineCSPNs.length === 0) {
      console.log('[getOnlineCpids] 沒有在線的充電站');
      return [];
    }
    
    // 收集所有在線 CPSN 對應的所有 CPID
    const allOnlineCpids = [];
    
    for (const cpsn of onlineCSPNs) {
      console.log(`[getOnlineCpids] 查詢 CPSN ${cpsn} 的所有 connector...`);
      
      // 查詢該 CPSN 下的所有充電樁（所有 connector）
      const guns = await findAllGuns({ cpsn });
      
      console.log(`[getOnlineCpids] CPSN ${cpsn} 找到 ${guns.length} 個 connector:`);
      guns.forEach(gun => {
        console.log(`[getOnlineCpids]   - CPID: ${gun.cpid}, Connector: ${gun.connector}, 狀態: ${gun.guns_status}`);
        allOnlineCpids.push(gun.cpid);
      });
      
      if (guns.length === 0) {
        console.log(`[getOnlineCpids] ⚠️ CPSN ${cpsn} 在資料庫中找不到對應記錄`);
      }
    }
    
    // 去除重複的 CPID（雖然通常不會重複）
    const uniqueOnlineCpids = [...new Set(allOnlineCpids)];
    
    console.log(`[getOnlineCpids] 最終找到 ${uniqueOnlineCpids.length} 個在線 CPID: [${uniqueOnlineCpids.join(', ')}]`);
    
    return uniqueOnlineCpids;
  } catch (e) {
    console.error('[getOnlineCpids] 獲取在線充電樁清單時發生錯誤:', e);
    return [];
  }
}

/**
 * 充電狀態事件判斷函數
 * 根據 OCPP 事件類型和載荷判斷充電狀態變化
 * @param {string} action OCPP 事件類型
 * @param {object} payload 事件載荷
 * @returns {boolean|null} true=開始充電, false=停止充電, null=無法判斷
 */
function detectChargingStatusChange(action, payload) {
    console.log(`[detectChargingStatusChange] 分析事件: ${action}, 載荷:`, JSON.stringify(payload));
    
    switch (action) {
        case 'StartTransaction':
            console.log('[detectChargingStatusChange] StartTransaction 事件 -> 判定為開始充電');
            return true;
            
        case 'StopTransaction':
            console.log('[detectChargingStatusChange] StopTransaction 事件 -> 判定為停止充電');
            return false;
            
        case 'StatusNotification':
            const status = (payload.status || '').toLowerCase();
            console.log(`[detectChargingStatusChange] StatusNotification 狀態: ${status}`);
            
            if (status.includes('charg') || status.includes('inuse')) {
                console.log('[detectChargingStatusChange] 狀態包含充電關鍵字 -> 判定為充電中');
                return true;
            }
            if (['available', 'unavailable', 'faulted', 'finishing'].includes(status)) {
                console.log('[detectChargingStatusChange] 狀態為非充電狀態 -> 判定為未充電');
                return false;
            }
            console.log('[detectChargingStatusChange] 狀態不明確 -> 無法判斷');
            return null;
            
        case 'MeterValues':
            // MeterValues 僅用於輔助判斷，不直接觸發配置更新
            console.log('[detectChargingStatusChange] MeterValues 事件 -> 不觸發狀態變更');
            return null;
            
        default:
            console.log(`[detectChargingStatusChange] 未知事件類型: ${action} -> 無法判斷`);
            return null;
    }
}


/**
 * @deprecated 
 */
async function scheduleGlobalPowerReallocation(eventType, eventDetails = {}, immediate = false) {
    const reallocationId = `${eventType}_${Date.now()}`;
    console.log(`[全站重分配] 🌐 開始全站功率重新分配 (ID: ${reallocationId})`);
    console.log(`[全站重分配] 📋 觸發事件: ${eventType}`);
    console.log(`[全站重分配] 📊 事件詳情:`, JSON.stringify(eventDetails));
    
    try {
        // 1. 獲取當前所有在線充電樁
        console.log(`[全站重分配] 🔍 獲取所有在線充電樁...`);
        const onlineCpids = await getOnlineCpids();
        
        if (onlineCpids.length === 0) {
            console.log(`[全站重分配] ⚠️  沒有在線充電樁，跳過重新分配`);
            return;
        }
        
        console.log(`[全站重分配] 📊 找到 ${onlineCpids.length} 個在線充電樁: [${onlineCpids.join(', ')}]`);
        
        // 2. 獲取場域設定
        const siteSetting = await getSiteSetting();
        console.log(`[全站重分配] ⚙️  場域設定: EMS模式=${siteSetting.ems_mode}, 最大功率=${siteSetting.max_power_kw}kW`);
        
        // 3. 清除所有現有的功率配置定時器，避免衝突
        console.log(`[全站重分配] 🧹 清除現有功率配置定時器...`);
        onlineCpids.forEach(cpid => {
            if (profileUpdateTimers[cpid]) {
                clearTimeout(profileUpdateTimers[cpid]);
                console.log(`[全站重分配] 🗑️  清除 ${cpid} 的現有定時器`);
            }
        });
        
        // 4. 批量排程所有在線充電樁的功率配置更新
        const executionMode = immediate ? '立即執行' : '延遲排程';
        console.log(`[全站重分配] 🚀 開始批量${executionMode}功率配置更新...`);
        
        let scheduledCount = 0;
        const baseDelay = immediate ? 0 : 1000; // 手動觸發時無延遲，自動觸發時基礎延遲 1 秒
        const intervalDelay = immediate ? 100 : 500; // 手動觸發時間隔較短
        
        for (let i = 0; i < onlineCpids.length; i++) {
            const cpid = onlineCpids[i];
            const delay = baseDelay + (i * intervalDelay);
            
            if (immediate) {
                console.log(`[全站重分配] ⚡ 立即執行 ${cpid} 功率配置更新，間隔 ${delay}ms`);
            } else {
                console.log(`[全站重分配] ⚡ 排程 ${cpid} 功率配置更新，延遲 ${delay}ms`);
            }
            
            // 使用特殊標記表示這是全站重新分配
            await scheduleProfileUpdate(cpid, delay, {
                isGlobalReallocation: true,
                isManualTrigger: immediate,
                reallocationId: reallocationId,
                triggerEvent: eventType,
                triggerDetails: eventDetails
            });
            
            scheduledCount++;
        }
        
        console.log(`[全站重分配] 📈 重分配統計:`);
        console.log(`[全站重分配]   - 執行模式: ${executionMode}`);
        console.log(`[全站重分配]   - 觸發事件: ${eventType}`);
        console.log(`[全站重分配]   - 在線充電樁: ${onlineCpids.length} 個`);
        console.log(`[全站重分配]   - 排程更新: ${scheduledCount} 個`);
        console.log(`[全站重分配]   - 預計完成: ${baseDelay + (scheduledCount * intervalDelay)}ms 後`);
        console.log(`[全站重分配] ✅ 全站功率重新分配排程完成 (ID: ${reallocationId})`);
        
        // 5. 延遲顯示全站功率配置總覽
        const totalDelay = baseDelay + (scheduledCount * intervalDelay) + (immediate ? 1000 : 2000); // 手動觸發較短等待時間
        setTimeout(async () => {
            try {
                console.log(`[全站重分配] 📊 顯示重分配後的功率配置總覽...`);
                await logCurrentPowerConfiguration(siteSetting.ems_mode, parseFloat(siteSetting.max_power_kw));
                console.log(`[全站重分配] 🎯 全站重分配完全完成 (ID: ${reallocationId})`);
            } catch (error) {
                console.error(`[全站重分配] ❌ 顯示功率總覽失敗:`, error);
            }
        }, totalDelay);
        
    } catch (error) {
        console.error(`[全站重分配] ❌ 全站功率重新分配失敗 (ID: ${reallocationId}):`);
        console.error(`[全站重分配] 錯誤訊息:`, error.message);
        console.error(`[全站重分配] 錯誤堆疊:`, error.stack);
    }
}

/**
 * 防抖動的配置更新調度器
 * 使用防抖機制和最小間隔限制，避免過度頻繁的配置下發
 * @param {string} cpid 充電樁 ID
 * @param {number} delay 延遲時間(毫秒)，預設為防抖延遲時間
 * @param {object} context 額外上下文資訊，可選
 */
async function scheduleProfileUpdate(cpid, delay = PROFILE_UPDATE_DEBOUNCE_MS, context = {}) {
    if (!cpid) {
        console.warn('[scheduleProfileUpdate] cpid 為空，跳過排程');
        return;
    }
    
    const isGlobalReallocation = context.isGlobalReallocation || false;
    const logPrefix = isGlobalReallocation ? '[全站重分配→單樁]' : '[scheduleProfileUpdate]';
    
    if (isGlobalReallocation) {
        console.log(`${logPrefix} 🔄 ${cpid} 功率配置更新 (重分配ID: ${context.reallocationId})，延遲 ${delay}ms`);
    } else {
        console.log(`${logPrefix} 排程 ${cpid} 功率配置更新，延遲 ${delay}ms`);
    }
    
    // 清除現有的定時器，實現防抖效果
    if (profileUpdateTimers[cpid]) {
        console.log(`${logPrefix} 清除 ${cpid} 的現有定時器`);
        clearTimeout(profileUpdateTimers[cpid]);
    }
    
    // 設置新的定時器
    profileUpdateTimers[cpid] = setTimeout(async () => {
        const now = Date.now();
        const isManualTrigger = context.isManualTrigger || false;
        
        // 手動觸發時跳過最小間隔限制檢查
        if (!isManualTrigger && lastProfileUpdateTime[cpid] && 
            now - lastProfileUpdateTime[cpid] < PROFILE_MIN_INTERVAL_MS) {
            const remainingTime = PROFILE_MIN_INTERVAL_MS - (now - lastProfileUpdateTime[cpid]);
            console.log(`${logPrefix} ${cpid} 更新間隔過短(剩餘 ${Math.ceil(remainingTime/1000)}s)，跳過此次更新`);
            return;
        }
        
        // 記錄更新時間
        lastProfileUpdateTime[cpid] = now;
        
        if (isGlobalReallocation) {
            const triggerMode = isManualTrigger ? '手動觸發' : '自動觸發';
            console.log(`${logPrefix} ⚡ 開始執行 ${cpid} 功率配置更新 (${triggerMode}, 重分配ID: ${context.reallocationId})`);
        } else {
            console.log(`${logPrefix} 開始執行 ${cpid} 功率配置更新`);
        }
        
        try {
            // 獲取場域設定
            const siteSetting = await getSiteSetting();
            console.log(`${logPrefix} ${cpid} 使用場域設定:`, JSON.stringify(siteSetting));
            
            // 觸發配置更新
            console.log(`${logPrefix} 呼叫 ocpp_send_command 為 ${cpid} 下發配置`);
            await ocpp_send_command(cpid, 'ocpp_set_charging_profile', { siteSetting });
            
            if (isGlobalReallocation) {
                console.log(`${logPrefix} ✅ ${cpid} 功率配置更新完成 (重分配ID: ${context.reallocationId})`);
            } else {
                console.log(`${logPrefix} ${cpid} 功率配置更新完成`);
            }
            
            // 額外記錄當前充電樁配置概況（簡化版）
            try {
                const { databaseService: dbService } = await loadDatabaseModules();
                const guns = await dbService.getGuns({ cpid });
                const gun = guns.length > 0 ? guns[0] : null;
                if (gun) {
                    const emoji = isGlobalReallocation ? '🌐' : '🔍';
                    console.log(`${emoji} [單樁更新] ${cpid} -> 類型:${gun.acdc} | 規格:${gun.max_kw}kW | 狀態:${gun.guns_status} | EMS:${siteSetting.ems_mode}`);
                }
            } catch (e) {
                console.log(`${logPrefix} 無法取得 ${cpid} 詳細資訊`);
            }
            
        } catch (error) {
            console.error(`${logPrefix} ${cpid} 更新失敗:`, error.message);
            console.error(`${logPrefix} 詳細錯誤:`, error);
        }
    }, delay);
    
    if (isGlobalReallocation) {
        console.log(`${logPrefix} 🕐 ${cpid} 定時器已設置，將在 ${delay}ms 後執行 (重分配ID: ${context.reallocationId})`);
    } else {
        console.log(`${logPrefix} ${cpid} 定時器已設置，將在 ${delay}ms 後執行`);
    }
}

/**
 * 獲取場域設定的輔助函數
 * 從資料庫讀取 EMS 模式和最大功率限制
 * @returns {object} 場域設定物件 {ems_mode, max_power_kw}
 */
async function getSiteSetting() {
    console.log('[getSiteSetting] 開始獲取場域設定...');
    
    try {
        const { databaseService: dbService } = await loadDatabaseModules();
        const settings = await dbService.getStations();
        const setting = settings.length > 0 ? settings[0] : null;
        
        if (setting) {
            const result = {
                ems_mode: setting.ems_mode || 'dynamic',
                max_power_kw: setting.max_power_kw || 50
            };
            console.log('[getSiteSetting] 從資料庫獲取設定:', JSON.stringify(result));
            return result;
        } else {
            const defaultSetting = { ems_mode: 'dynamic', max_power_kw: 50 };
            console.log('[getSiteSetting] 資料庫無設定，使用預設值:', JSON.stringify(defaultSetting));
            return defaultSetting;
        }
        
    } catch (error) {
        console.error('[getSiteSetting] 獲取場域設定時發生錯誤:', error.message);
        console.error('[getSiteSetting] 詳細錯誤:', error);
        
        const fallbackSetting = { ems_mode: 'dynamic', max_power_kw: 50 };
        console.log('[getSiteSetting] 使用容錯預設值:', JSON.stringify(fallbackSetting));
        return fallbackSetting;
    }
}

/**
 * 從 wsCpdatas 獲取 cpid 的輔助函數
 * 根據 cpsn 和 connector 編號找到對應的 cpid 映射
 * @param {string} cpsn 充電站序號
 * @param {number} connector 連接器編號 (1 或 2)
 * @returns {string|null} 對應的 cpid，找不到則返回 null
 */
function getCpidFromWsData(cpsn, connector) {
    console.log(`[getCpidFromWsData] 查找 cpsn: ${cpsn}, connector: ${connector} 的 cpid 映射`);
    
    try {
        const wsData = wsCpdatas[cpsn] && wsCpdatas[cpsn][0];
        if (!wsData) {
            console.log(`[getCpidFromWsData] 找不到 ${cpsn} 的 WebSocket 資料`);
            console.log(`[getCpidFromWsData] 現有 wsCpdatas keys:`, Object.keys(wsCpdatas));
            return null;
        }
        
        // 詳細診斷 wsData 結構
        // console.log(`[getCpidFromWsData] ${cpsn} 的 wsData 結構:`, JSON.stringify(wsData, null, 2));
        
        let cpid = null;
        if (connector === 1) {
            cpid = wsData.connector_1_meter?.cpid_mapping;
            console.log(`[getCpidFromWsData] connector 1 的 cpid 映射: ${cpid}`);
            if (!wsData.connector_1_meter) {
                console.warn(`[getCpidFromWsData] ${cpsn} 缺少 connector_1_meter 結構`);
            }
        } else if (connector === 2) {
            cpid = wsData.connector_2_meter?.cpid_mapping;
            console.log(`[getCpidFromWsData] connector 2 的 cpid 映射: ${cpid}`);
            if (!wsData.connector_2_meter) {
                console.warn(`[getCpidFromWsData] ${cpsn} 缺少 connector_2_meter 結構`);
            }
        } else {
            console.warn(`[getCpidFromWsData] 不支援的 connector 編號: ${connector}`);
        }
        
        if (cpid) {
            console.log(`[getCpidFromWsData] 成功找到映射: ${cpsn}:${connector} -> ${cpid}`);
        } else {
            console.log(`[getCpidFromWsData] 未找到 ${cpsn}:${connector} 的 cpid 映射`);
            // 嘗試從資料庫查找並建立映射
            console.log(`[getCpidFromWsData] 嘗試從資料庫重新建立 ${cpsn}:${connector} 的映射`);
            setTimeout(() => cpid_mapping(cpsn, connector), 100);
        }
        
        return cpid;
        
    } catch (error) {
        console.error('[getCpidFromWsData] 獲取 cpid 映射時發生錯誤:', error.message);
        console.error('[getCpidFromWsData] 詳細錯誤:', error);
        return null;
    }
}

/**
 * 取得充電站的主要 cpid (預設使用 connector 1，如果沒有則使用 connector 2)
 * @param {string} cpsn 充電站序號
 * @returns {string} 對應的 cpid，找不到則使用 cpsn 作為 fallback
 */
function getStationPrimaryCpid(cpsn) {
    console.log(`[getStationPrimaryCpid] 取得充電站 ${cpsn} 的主要 cpid`);
    
    // 優先嘗試 connector 1
    let cpid = getCpidFromWsData(cpsn, 1);
    
    // 如果 connector 1 沒有，嘗試 connector 2
    if (!cpid) {
        console.log(`[getStationPrimaryCpid] connector 1 沒有 cpid，嘗試 connector 2`);
        cpid = getCpidFromWsData(cpsn, 2);
    }
    
    // 如果都沒有，嘗試直接從資料庫查詢第一個可用的 cpid
    if (!cpid) {
        console.log(`[getStationPrimaryCpid] WebSocket 映射不存在，嘗試從資料庫查詢 ${cpsn}`);
        
        // 使用同步方式快速查詢（僅作為 fallback）
        try {
            // 這裡應該使用同步查詢或者已快取的資料
            // 暫時使用 cpsn 作為 fallback，並觸發非同步映射建立
            console.warn(`[getStationPrimaryCpid] 無法立即找到 ${cpsn} 的 cpid 映射`);
            console.log(`[getStationPrimaryCpid] 將觸發非同步 cpid 映射建立...`);
            
            // 非同步建立映射，不阻塞當前流程
            setTimeout(() => {
                cpid_mapping(cpsn, 1);
                cpid_mapping(cpsn, 2);
            }, 50);
            
            cpid = cpsn; // 使用充電站序號作為臨時 fallback
        } catch (error) {
            console.error(`[getStationPrimaryCpid] 查詢過程發生錯誤:`, error);
            cpid = cpsn;
        }
    }
    
    console.log(`[getStationPrimaryCpid] ${cpsn} 的主要 cpid: ${cpid}`);
    return cpid;
}


//ocpp var
var idtag_id="wang1234"
var trans_id=0
var ocpp_id_send="408";

//////////////////////////////////////////////////******************************
//////////////////////////////////////////////////******************************
var sim_mode = 1 //if 1 = sim mode, 0 = normal mode
/////////////////////
let nIntervId;
var sim_data1=0.00
var sim_data2=0.00
//


var cpid="1002";
var cp_online="online"
var cp_current_status="Available"
var cp_data1='0.00'
var cp_data2='0.00'
var cp_data3='0.0'
var cp_data4=''
var cp_data5=''
var cp_data6=''

var before_status = "Available";



/**
 * @deprecated 
 */
async function cpid_mapping(gun_cpsn,gun_connector){
    console.log(`[cpid_mapping] 開始為 ${gun_cpsn}:${gun_connector} 建立映射`);
    
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpsn: gun_cpsn, connector: String(gun_connector) });
    const gun_cpid = guns.length > 0 ? guns[0] : null;

    console.log(`[cpid_mapping] 資料庫查詢結果: 找到 ${guns.length} 筆記錄`);
    if (guns.length > 0) {
        console.log(`[cpid_mapping] 第一筆記錄:`, JSON.stringify(gun_cpid));
    }

    if(gun_cpid !== null){
        console.log(`[cpid_mapping] 找到 gun_cpid: ${gun_cpid.cpid} for ${gun_cpsn}:${gun_connector}`);
        
        // 確保 wsCpdatas 結構存在
        if (!wsCpdatas[gun_cpsn] || !wsCpdatas[gun_cpsn][0]) {
            console.log(`[cpid_mapping] 初始化 ${gun_cpsn} 的 wsCpdatas 結構`);
            if (!wsCpdatas[gun_cpsn]) wsCpdatas[gun_cpsn] = [{}];
            if (!wsCpdatas[gun_cpsn][0]) wsCpdatas[gun_cpsn][0] = {};
        }
        
        if(gun_connector==1){
            if (!wsCpdatas[gun_cpsn][0].connector_1_meter) {
                wsCpdatas[gun_cpsn][0].connector_1_meter = {};
            }
            wsCpdatas[gun_cpsn][0].connector_1_meter.cpid_mapping = gun_cpid.cpid;
            console.log(`[cpid_mapping] 設置 connector 1 映射: ${gun_cpid.cpid}`);
            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[gun_cpsn][0]));

        }
        if(gun_connector==2){
            if (!wsCpdatas[gun_cpsn][0].connector_2_meter) {
                wsCpdatas[gun_cpsn][0].connector_2_meter = {};
            }
            wsCpdatas[gun_cpsn][0].connector_2_meter.cpid_mapping = gun_cpid.cpid;
            console.log(`[cpid_mapping] 設置 connector 2 映射: ${gun_cpid.cpid}`);
            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[gun_cpsn][0]));

        }
    }
    else{
        console.log(`[cpid_mapping] ❌ 資料庫中找不到 cpsn: ${gun_cpsn}, connector: ${gun_connector} 的記錄!`);
        
        // 查詢該 cpsn 的所有記錄進行診斷
        try {
            const allGunsForCpsn = await dbService.getGuns({ cpsn: gun_cpsn });
            console.log(`[cpid_mapping] 該 cpsn ${gun_cpsn} 在資料庫中的所有記錄:`, allGunsForCpsn.length);
            allGunsForCpsn.forEach((gun, index) => {
                console.log(`[cpid_mapping] 記錄 ${index + 1}: cpid=${gun.cpid}, connector=${gun.connector}, status=${gun.guns_status}`);
            });
        } catch (error) {
            console.error(`[cpid_mapping] 查詢 ${gun_cpsn} 所有記錄時發生錯誤:`, error.message);
        }
    }

    return 0;
}

/**
 * @deprecated 
 */
async function update_guns_meters(gun_cpsn,gun_connector,gun_data1,gun_data2,gun_data3,gun_data4){
    console.log("into update_guns_meters()");
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpsn: gun_cpsn, connector: String(gun_connector) });
    const gun_cpid = guns.length > 0 ? guns[0] : null;
    var now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()

    if(gun_cpid !== null){

        if(gun_data1 != gun_cpid.guns_metervalue1){
            console.log("before metervalues1 ="+gun_cpid.guns_metervalue1+"new is="+gun_data1);

            const updateData = {
                guns_metervalue1:gun_data1,
                guns_metervalue2:gun_data2,
                guns_metervalue3:gun_data3,
                guns_metervalue4:gun_data4,
                guns_memo2:now_time
            };

            if(gun_cpid.guns_metervalue5==null || gun_cpid.guns_metervalue6==null){
                console.log("!!!!! data5 or data6 == null!!!!!");
                if(gun_cpid.guns_metervalue5==null){
                    updateData.guns_metervalue5 = "0.00";
                }
                if(gun_cpid.guns_metervalue6==null){
                    updateData.guns_metervalue6 = "0.00";
                }
            }

            await dbService.updateGun(gun_cpid.id, updateData);

            if(gun_connector =="1"){
                await send_cp_to_kw_api(gun_cpid.cpid,gun_cpid.guns_status,gun_data1,gun_data2,gun_data3,gun_cpid.guns_metervalue4,gun_cpid.guns_metervalue5 || "0.00",gun_cpid.guns_metervalue6 || "0.00")
            }
            if(gun_connector =="2"){
                await send_cp_to_kw_api(gun_cpid.cpid,gun_cpid.guns_status,gun_data1,gun_data2,gun_data3,gun_cpid.guns_metervalue4,gun_cpid.guns_metervalue5 || "0.00",gun_cpid.guns_metervalue6 || "0.00")
            }
        }else{
            console.log("same data !!!!! - so no update them  => before metervalues1 ="+gun_cpid.guns_metervalue1+"new is="+gun_data1);
            
            const updateData = {
                guns_metervalue1:gun_data1,
                guns_metervalue2:gun_data2,
                guns_metervalue3:gun_data3,
                guns_metervalue4:gun_data4,
                guns_memo2:now_time
            };

            if(gun_cpid.guns_metervalue5==null || gun_cpid.guns_metervalue6==null){
                console.log("!!!!! data5 or data6 == null!!!!!");
                if(gun_cpid.guns_metervalue5==null){
                    updateData.guns_metervalue5 = "0.00";
                }
                if(gun_cpid.guns_metervalue6==null){
                    updateData.guns_metervalue6 = "0.00";
                }
            }

            await dbService.updateGun(gun_cpid.id, updateData);
        }
    }
    else{
        console.log("gun_cpid not find == null!!!!!");
    }

    return 0;
}

/**
 * @deprecated 
 */
async function update_guns_memo2(gun_cpsn,gun_connector){
    console.log("into update_guns_memo2()");
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpsn: gun_cpsn, connector: String(gun_connector) });
    const gun_cpid = guns.length > 0 ? guns[0] : null;
    
    if (gun_cpid) {
        var now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
        await dbService.updateGun(gun_cpid.id, {
            guns_memo2:now_time
        });
    }
    return 0;
}

/**
 * @deprecated 
 */
async function send_cp_to_kw_api(kw_cpid,kw_gun_status,data1,data2,data3,data4,data5,data6) {
    //外站接口
    //gun_cpid={"id":4,"connector":"0","cpsn":"spacepark102","guns_data1":"Available","createdAt":null,"updatedAt":"2024-01-09"}
    console.log("into kw_api:"+kw_gun_status+"cpid="+kw_cpid+"data="+data1+";"+data2+";"+data3+";"+data4+";"+data5+";"+data6);
    const api = 'https://www.spacepark-ev.com/api/cp-callback';
//  const api = 'https://www.spacepark-ev.com/api/cp-callback';
    //  const api = 'http://localhost:8091/send_cp_to_kw_api_test';

    axios.post(api,{
        apikey:'cp_api_key16888',
        cpid: kw_cpid,
        cmd:'report_cp_status',
        cp_online: "online",
        current_status: kw_gun_status,
        data1: data1,
        data2: data2,
        data3: data3,
        data4: data4,
        data5: data5,
        data6: data6
    })
        .then(function (response) {
            //这里获得整个请求响应对象
            //console.log(response);
            var aaa=response.data;
            var bbb=JSON.stringify(aaa);
            console.log('new_url_kwfeeback:'+ bbb);

        })
        .catch(function (error) {
//  console.log(error);
            console.log("kw_new_url_error");
        })
        .then(function () {
        });

}
/**
 * @deprecated 
 */
async function ocpp_send_command(cpid,cmd, payload) {
    //外站接口
    //gun_cpid={"id":4,"connector":"0","cpsn":"spacepark102","guns_data1":"Available","createdAt":null,"updatedAt":"2024-01-09"}
    console.log("into function ocpp_send_command");
    const { databaseService: dbService } = await loadDatabaseModules();
    const guns = await dbService.getGuns({ cpid : cpid });
    const gun = guns.length > 0 ? guns[0] : null;
    
    if (!gun) {
        console.error(`Gun with cpid ${cpid} not found`);
        return;
    }
    
    //  console.log("gun="+gun);
    const cpsn = gun.cpsn;
    console.log("gun.cpid="+gun.cpid);
    console.log("ocpp_send_cpsn="+cpsn);
    console.log("gun.gun_status="+gun.guns_status);
    console.log("gun.connector="+gun.connector);
    console.log("gun.transactionid="+gun.transactionid);

    if(gun.connector==1){
        gun.transactionid = "1111"
    }
    if(gun.connector==2){
        gun.transactionid = "2222"
    }

    if(cmd=="ocpp_status"){
        const result = { succeed: true };
        var  ocpp_id_send="667751515";
        var tt_obj=[2,ocpp_id_send,"TriggerMessage",{"connectorId":parseInt(gun.connector),"requestedMessage":"StatusNotification"}]
        console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
        if(wsClients[cpsn] !== undefined) {
            wsClients[cpsn].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        console.log('result:'+JSON.stringify(result))
    }

    if(cmd=="ocpp_meters"){
        const result = { succeed: true };
        var  ocpp_id_send="667751515";
        var tt_obj=[2,"667751515","TriggerMessage",{"requestedMessage":"MeterValues","connectorId":parseInt(gun.connector)}]
        console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
        if(wsClients[cpsn] !== undefined) {
            wsClients[cpsn].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        console.log('result:'+JSON.stringify(result))
    }

    if(cmd=="ocpp_stop_charging"){
        const result = { succeed: true };
        var  ocpp_id_send="667751515";
        //  var tt_obj=[2,"bensoncsms-101-ocpp-send-stop_charging","RemoteStopTransaction",{"connectorId":parseInt(gun.connector),"transactionId":parseInt(gun.transactionid)}]
        var tt_obj=[2,"667751515","RemoteStopTransaction",{"transactionId":parseInt(gun.transactionid)}]

        console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
        if(wsClients[cpsn] !== undefined) {
            wsClients[cpsn].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        console.log('result:'+JSON.stringify(result))
    }

    if(cmd=="ocpp_start_charging"){
        const result = { succeed: true };
        var  ocpp_id_send="667751515";
        var tt_obj=[2,"667751515","RemoteStartTransaction",{"idTag":idtag_id,"connectorId":1}]
        //  var tt_obj=[2,"bensoncsms-101-ocpp-send-start_charging","RemoteStartTransaction",{"idTag":idtag_id,"connectorId":parseInt(gun.connector),"transactionId":parseInt(gun.transactionid)}]
        //  var tt_obj=[2,"bensoncsms-101-ocpp-send-start_charging","RemoteStartTransaction",{"idTag":idtag_id,"connectorId":parseInt(gun.connector)}]

        console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
        if(wsClients[cpsn] !== undefined) {
            wsClients[cpsn].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        console.log('result:'+JSON.stringify(result))
    }

    if(cmd=="ocpp_set_charging_profile"){
        const result = { succeed: true };
        // 組出 OCPP 設定指令
        console.log("[ocpp_set_charging_profile] ocpp_send_command siteSetting:", JSON.stringify(payload));
        const ems_mode = payload.siteSetting.ems_mode;
        const max_power_kw = parseFloat(payload.siteSetting.max_power_kw); // 場域總功率限制
        
        // 取得在線上充電樁的 cpid 清單
        const onlineCpids = Object.keys(wsClients).filter(cpid => wsClients[cpid] && wsClients[cpid].length > 0);
        console.log('在線上充電樁數量:', onlineCpids.length);
        console.log('在線上充電樁清單:', onlineCpids);

        // 取得所有充電樁資料
        const allGuns = await dbService.getGuns({});
        
        // 調試：檢查數據結構
        console.log(`[DEBUG] 查詢到 ${allGuns.length} 個充電樁`);
        allGuns.forEach(g => {
            console.log(`[DEBUG] CPID:${g.cpid}(${typeof g.cpid}) | CPSN:${g.cpsn} | AC/DC:${g.acdc} | 規格:${g.max_kw}kW | 狀態:${g.guns_status}`);
        });
        console.log(`[DEBUG] 目標gun.cpid:${gun.cpid}(${typeof gun.cpid})`);
        
        // 使用正確的 EMS 分配演算法
        console.log(`[EMS計算] 使用 ${ems_mode} 模式計算功率分配`);
        const siteSetting = { ems_mode, max_power_kw };
        const emsResult = calculateEmsAllocation(siteSetting, allGuns, onlineCpids);
        const allocation = emsResult.allocations;
        
        // 輸出 EMS 計算日誌
        emsResult.logs.forEach(log => console.log(`[EMS] ${log}`));
        
        // 🔍 調試：檢查分配結果
        console.log(`[DEBUG] EMS分配結果包含 ${allocation.length} 個充電樁`);
        allocation.forEach(a => {
            console.log(`[DEBUG] 分配 CPID:${a.cpid}(${typeof a.cpid}) | 功率:${a.allocated_kw}kW | 狀態:${a.charging ? '充電中' : '待機'} | 限制:${a.limit}${a.unit}`);
        });
        
        // 查找當前充電樁的分配結果
        const gunAllocation = allocation.find(a => a.cpid === gun.cpid);
        console.log(`[DEBUG] 查找 gun.cpid=${gun.cpid} 的結果:`, gunAllocation ? '找到' : '未找到');
        
        let unit, limit;
        
        if (!gunAllocation) {
            console.log(`[EMS警告] 找不到 CPID:${gun.cpid} 的分配結果，使用預設值`);
            unit = gun.acdc === 'AC' ? 'A' : 'W';
            limit = gun.acdc === 'AC' ? 6 : 1000; // 最小值
        } else {
            console.log(`[EMS結果] CPID:${gun.cpid} | 類型:${gun.acdc} | 狀態:${gunAllocation.charging ? '充電中' : '待機'} | 分配:${gunAllocation.allocated_kw}kW | 原規格:${gunAllocation.original_max_kw}kW`);
            
            // 直接使用EMS演算法計算好的單位和限制值
            unit = gunAllocation.unit;
            limit = gunAllocation.limit;
            
            console.log(`[EMS配置] CPID:${gun.cpid} 最終配置: ${limit}${unit} (相當於${gunAllocation.allocated_kw}kW)`);
        }
        
        const ocpp_id_send = "667751518";
        const networkDelayMs = 5000; // 5 秒
        const startTime = new Date(Date.now() + networkDelayMs).toISOString();
        const tt_obj = [
            2,
            ocpp_id_send,
            "SetChargingProfile",
            {
                connectorId: parseInt(gun.connector),
                csChargingProfiles: {
                    chargingProfileId: 1,
                    stackLevel: 1,
                    chargingProfilePurpose: "TxDefaultProfile",
                    chargingProfileKind: "Absolute",
                    chargingSchedule: {
                        chargingRateUnit: unit,
                        startSchedule: startTime,
                        chargingSchedulePeriod: [
                            {
                                startPeriod: 0,
                                limit: limit
                            }
                        ]
                    }
                }
            }
        ];
        // 下發給對應的 ws
        if(wsClients[cpsn] !== undefined) {
            wsClients[cpsn].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
            console.log(`[ocpp_set_charging_profile] 已下發給 ${cpsn}:`, JSON.stringify(tt_obj));
            
            // 記錄功率配置詳情到 console
            console.log(`🔋 [功率配置] CPID:${gun.cpid} | 充電站:${cpsn} | 類型:${gun.acdc} | 配置:${limit}${unit} | 狀態:${gun.guns_status || 'Unknown'}`);
        } else {
            console.log(`[ocpp_set_charging_profile] ${cpsn} 不在線`);
        }
    }

}

/**
 * @deprecated 
 */
async function logCurrentPowerConfiguration(emsMode, maxPowerKw) {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('📊 【全站功率配置總覽】');
        console.log(`🔧 EMS模式: ${emsMode.toUpperCase()} | 💡 場域總功率: ${maxPowerKw}kW`);
        console.log('='.repeat(80));
        
        // 獲取所有充電樁資料
        const { databaseService: dbService } = await loadDatabaseModules();
        const allGuns = await dbService.getGuns({});
        const onlineCpids = Object.keys(wsClients).filter(cpid => wsClients[cpid] && wsClients[cpid].length > 0);
        
        // 🚀 使用正確的 EMS 分配演算法
        const siteSetting = { ems_mode: emsMode, max_power_kw: maxPowerKw };
        const emsResult = calculateEmsAllocation(siteSetting, allGuns, onlineCpids);
        const allocation = emsResult.allocations;
        
        // 分類統計
        const acGuns = allGuns.filter(g => g.acdc === 'AC');
        const dcGuns = allGuns.filter(g => g.acdc === 'DC');
        const onlineAcGuns = acGuns.filter(g => onlineCpids.includes(g.cpsn));
        const onlineDcGuns = dcGuns.filter(g => onlineCpids.includes(g.cpsn));
        
        // 檢查充電狀態的輔助函數
        const isCharging = (status) => {
            if (!status) return false;
            const statusLower = status.toString().toLowerCase();
            return statusLower.includes('charg') || statusLower.includes('inuse') || statusLower === 'charging';
        };
        
        const chargingAcGuns = onlineAcGuns.filter(g => isCharging(g.guns_status));
        const chargingDcGuns = onlineDcGuns.filter(g => isCharging(g.guns_status));
        
        console.log(`📈 充電站統計: 總數=${allGuns.length} | 線上=${onlineCpids.length} | AC線上=${onlineAcGuns.length} | DC線上=${onlineDcGuns.length}`);
        console.log(`⚡ 充電中統計: AC充電=${chargingAcGuns.length} | DC充電=${chargingDcGuns.length}`);
        console.log('-'.repeat(80));
        
        // AC 充電樁配置詳情
        if (onlineAcGuns.length > 0) {
            console.log('🔌 AC充電樁配置詳情:');
            let totalAcCurrentA = 0;
            let totalAcPowerKw = 0;
            
            onlineAcGuns.forEach(gun => {
                const status = gun.guns_status || 'Unknown';
                const charging = isCharging(status) ? '⚡充電中' : '⏸️待機';
                const maxKw = parseFloat(gun.max_kw || 0);
                
                // 從EMS分配結果獲取配置值
                const gunAllocation = allocation.find(a => a.cpid === gun.cpid);
                let allocatedCurrentA, allocatedPowerKw;
                
                if (gunAllocation) {
                    allocatedCurrentA = gunAllocation.limit; // EMS已經計算好的A值
                    allocatedPowerKw = gunAllocation.allocated_kw; // EMS已經計算好的kW值
                } else {
                    // 備用值
                    allocatedCurrentA = 6;
                    allocatedPowerKw = (6 * 220) / 1000;
                }
                
                totalAcCurrentA += allocatedCurrentA;
                totalAcPowerKw += allocatedPowerKw;
                
                console.log(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedCurrentA.toString().padStart(3)}A | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 規格:${maxKw}kW`);
            });
            
            console.log(`  🔋 AC總計: ${totalAcCurrentA}A | ${totalAcPowerKw.toFixed(2)}kW`);
            console.log('-'.repeat(80));
        }
        
        // DC 充電樁配置詳情
        if (onlineDcGuns.length > 0) {
            console.log('🔋 DC充電樁配置詳情:');
            let totalDcPowerW = 0;
            let totalDcPowerKw = 0;
            
            onlineDcGuns.forEach(gun => {
                const status = gun.guns_status || 'Unknown';
                const charging = isCharging(status) ? '⚡充電中' : '⏸️待機';
                const maxKw = parseFloat(gun.max_kw || 0);
                
                // 從EMS分配結果獲取配置值
                const gunAllocation = allocation.find(a => a.cpid === gun.cpid);
                let allocatedPowerW, allocatedPowerKw;
                
                if (gunAllocation) {
                    allocatedPowerW = gunAllocation.limit; // EMS已經計算好的W值
                    allocatedPowerKw = gunAllocation.allocated_kw; // EMS已經計算好的kW值
                } else {
                    // 備用值
                    allocatedPowerW = 1000;
                    allocatedPowerKw = 1;
                }
                
                totalDcPowerW += allocatedPowerW;
                totalDcPowerKw += allocatedPowerKw;
                
                console.log(`  📍 ${gun.cpid.padEnd(12)} | ${gun.cpsn.padEnd(20)} | ${charging.padEnd(8)} | ${allocatedPowerW.toString().padStart(6)}W | ${allocatedPowerKw.toFixed(2).padStart(6)}kW | 規格:${maxKw}kW`);
            });
            
            console.log(`  ⚡ DC總計: ${totalDcPowerW}W | ${totalDcPowerKw.toFixed(2)}kW`);
            console.log('-'.repeat(80));
        }
        
        // 功率使用統計 - 使用EMS分配結果
        const totalUsedPower = emsResult.summary.total_allocated_kw;
        const powerUtilization = (totalUsedPower / maxPowerKw * 100).toFixed(1);
        
        console.log(`📊 功率使用統計:`);
        console.log(`  💡 場域總功率: ${maxPowerKw}kW`);
        console.log(`  ⚡ 實際使用功率: ${totalUsedPower.toFixed(2)}kW`);
        console.log(`  📈 功率使用率: ${powerUtilization}%`);
        console.log(`  ⏰ 更新時間: ${new Date().toLocaleString('zh-TW')}`);
        console.log('='.repeat(80));
        console.log('📊 【功率配置總覽完成】\n');
        
    } catch (error) {
        console.error('❌ 記錄功率配置總覽時發生錯誤:', error);
    }
}

/**
 * @deprecated 
 */
const ocppController = {
    /*
       功能: KW api----
       方法: POST
       //HTTP api with KW
       // charger cp api
    */
    spacepark_cp_api: async (req, res) => {
        console.log("into /spacepark_cp_api");
        console.log("req.body="+JSON.stringify(req.body));
        //  console.log(req.body.apikey);
        console.log("cpid="+req.body.cp_id);
        let cp_api=req.body.apikey;
        var cp_cmd=req.body.cmd;
        var cpid=req.body.cp_id;

        //  start_charging_id = req.body.start_charging_id;
        //  console.log(start_charging_id);
        //  cp_data6=req.body.start_charging_id;
        if(typeof cpid === "undefined" || cpid === ""){
            console.log("cp_id="+cpid);
            var error_code = {	status: 'err',
                msg: 'cpid undefined'}
            res.setHeader('content-type', 'application/json');
            res.status(400).send(JSON.stringify(error_code));

        }else{

            let res_data={
                cp_res: 'start_charging_now'
            }


            try {
                const { databaseService: dbService } = await loadDatabaseModules();
                const guns = await dbService.getGuns({ cpid : cpid });
                const gun = guns.length > 0 ? guns[0] : null;

                console.log("gundata="+JSON.stringify(gun));

                if(gun==null){
                    console.log("cpid="+req.body.cpid);
                    var error_code = {	status: 'err',
                        msg: 'cpid:'+cpid+" is not found"}
                    res.setHeader('content-type', 'application/json');
                    res.status(400).send(JSON.stringify(error_code));

                }else{
                    let res_cp_status={
                        cp_res: "cp_status",
                        cpid: gun.cpid,
                        cp_online: "online",
                        current_status: gun.guns_status,
                        data1: gun.guns_metervalue1,
                        data2: gun.guns_metervalue2,
                        data3: gun.guns_metervalue3,
                        data4: gun.guns_metervalue4,
                        data5: gun.guns_metervalue5,
                        data6: gun.guns_metervalue6
                    }

                    //get_cp_data();

                    if(cp_api=='cp_api_key16888'){
                        switch (cp_cmd) {
                            case 'cmd_set_charging_profile':
                                const { siteSetting } = req.body.payload || {};
                                if (!siteSetting) {
                                    res.status(400).json({ status: 'err', msg: 'siteSetting missing' });
                                    break;
                                }
                                console.log(`[cmd_set_charging_profile] 收到 siteSetting: ${JSON.stringify(siteSetting)}`);
                                ocpp_send_command(cpid,"ocpp_set_charging_profile", { siteSetting });
                                res.status(200).json({ success: true, msg: `Profile sent to ${cpid}`});
                                break;
                            case 'cmd_start_charging':
                                res.status(200)
                                var start_charging_id = req.body.start_charging_id;
                                console.log("start_charging_id="+start_charging_id);

                                await dbService.updateGun(gun.id, {
                                    guns_metervalue6: start_charging_id,
                                    updatedAt: new Date()
                                });
                                console.log("to_kw_cp_data6="+start_charging_id);
                                res_data.cp_res='start_charging_now'
                                var str = JSON.stringify(res_data);
                                console.log('res.send:' + str );

                                res.setHeader('content-type', 'application/json');
                                res.send(str);
                                //設定自動pulling metervalues , 3 秒一次
                                //   if (!nIntervId) {
                                //    nIntervId = setInterval(get_cp_data, set_loop_time);
                                //  }

                                ocpp_send_command(cpid,"ocpp_start_charging");

                                break;

                            case 'cmd_stop_charging':
                                res.status(200)
                                res_data.cp_res='stop_charging_now'
                                var str = JSON.stringify(res_data);
                                console.log('res.send:' + str );
                                res.setHeader('content-type', 'application/json');
                                res.send(str);
                                ocpp_send_command(cpid,"ocpp_stop_charging");

                                break;

                            case 'get_cp_status':
                                ocpp_send_command(cpid,"ocpp_status");
                                ocpp_send_command(cpid,"ocpp_meters");

                                res.status(200)
                                var str = JSON.stringify(res_cp_status);
                                console.log('res.send:' + str );

                                res.setHeader('content-type', 'application/json');
                                res.send(str);
                                // get_cp_data();
                                // send_cp_to_kw_api()
                                break;

                            default:
                                console.log(`Sorry,out of cmd:`+cp_cmd);
                                var error_code = {	status: 'err',
                                    msg: 'cmd不存在'}
                                res.setHeader('content-type', 'application/json');
                                res.status(400).send(JSON.stringify(error_code));
                        }
                        // end of this case-switch
                    } else{
                        console.log(`Sorry,worng cp_api_key:`+cp_api);
                        var error_code = {	status: 'err',
                            msg: 'key不存在'}
                        res.setHeader('content-type', 'application/json');
                        res.status(400).send(JSON.stringify(error_code));

                    }
                }
            } //end of try{}
            catch (e) {
                console.log(e)
            }


        }


    },
    
    /*
       功能: 手動觸發全站功率配置更新
       方法: POST
       用途: 
       - 系統維護時手動重新分配功率
       - 場域設定變更後立即更新所有充電樁
       - 應急情況下強制同步功率配置
       - 測試和除錯功率管理系統
    */
    trigger_profile_update: async (req, res) => {
        try {
            console.log('🚀 [trigger_profile_update] 收到手動觸發全站功率配置更新請求');
            console.log(`[trigger_profile_update] 📅 觸發時間: ${new Date().toISOString()}`);
            console.log(`[trigger_profile_update] 🖥️  請求來源IP: ${req.ip || req.connection.remoteAddress}`);
            
            // 解析請求體以獲取額外資訊
            const requestData = req.body || {};
            console.log(`[trigger_profile_update] 📊 請求資料:`, JSON.stringify(requestData));
            
            // 使用新的全站功率重新分配系統（立即執行模式）
            console.log('[trigger_profile_update] 🔄 使用全站功率重新分配系統（立即執行模式）...');
            
            // 觸發全站重新分配（立即執行，非阻塞）
            scheduleGlobalPowerReallocation('ManualTrigger', {
                source: requestData.source || 'manual-api-trigger',
                userAgent: requestData.userAgent || req.headers['user-agent'],
                clientIP: requestData.clientIP || req.ip || req.connection.remoteAddress,
                timestamp: requestData.timestamp || new Date().toISOString(),
                triggerAPI: '/ocpp/api/trigger_profile_update'
            }, true); // 第三個參數 immediate = true
            
            // 獲取當前在線充電樁清單以回傳統計資訊
            const onlineCpids = await getOnlineCpids();
            console.log(`[trigger_profile_update] 📊 線上充電樁統計: ${onlineCpids.length} 個`);
            
            if (onlineCpids.length === 0) {
                console.log('[trigger_profile_update] ⚠️  目前無在線充電樁，無需更新');
                return res.json({
                    success: true,
                    message: '目前無在線充電樁，無需進行功率配置更新',
                    onlineStations: 0,
                    scheduledUpdates: 0,
                    timestamp: new Date().toISOString(),
                    method: 'global-reallocation-immediate'
                });
            }
            
            // 回傳成功回應（不等待實際完成）
            const response = {
                success: true,
                message: `已立即觸發全站功率重新分配，涵蓋 ${onlineCpids.length} 個在線充電樁`,
                onlineStations: onlineCpids.length,
                scheduledUpdates: onlineCpids.length, // 每個在線充電樁都會被更新
                estimatedCompletionTime: `${Math.ceil((onlineCpids.length * 0.1) + 1)} 秒`, // 立即執行，完成時間較短
                timestamp: new Date().toISOString(),
                method: 'global-reallocation-immediate',
                trigger: {
                    source: requestData.source || 'manual-api-trigger',
                    userAgent: requestData.userAgent || req.headers['user-agent'],
                    clientIP: requestData.clientIP || req.ip
                }
            };
            
            console.log(`[trigger_profile_update] ✅ 手動觸發完成，回傳結果:`, response);
            res.json(response);
            
        } catch (error) {
            console.error('❌ [trigger_profile_update] 手動觸發過程中發生錯誤:');
            console.error('[trigger_profile_update] 錯誤訊息:', error.message);
            console.error('[trigger_profile_update] 錯誤堆疊:', error.stack);
            
            // 回傳錯誤回應
            res.status(500).json({
                success: false,
                message: '觸發功率配置更新失敗',
                error: error.message,
                timestamp: new Date().toISOString(),
                method: 'global-reallocation'
            });
        }
    },
    /*
       功能: ocpp see connections
       方法: get
  
    */
    ocpp_see_connections: async (req, res) => {
        console.log("into ocpp_see_connections")
        // Prevent creating multiple intervals if endpoint is called repeatedly
        if (global.__ocppConnectionsInterval) {
            console.log('ocpp connections monitor already running')
            res.send('ocpp connections monitor already running')
            return
        }

        global.__ocppConnectionsInterval = setInterval(() => {
            // 定时打印连接池数量
            console.log('OCPP connection counts:')
            Object.keys(wsClients).forEach(key => {
                console.log(key, ':', wsClients[key].length);

                console.log(key, 'wsCpdatas:', JSON.stringify(wsCpdatas[key] ? wsCpdatas[key][0] : null));

            })
            console.log('-----------------------------');
        }, 10000);

        // Print an immediate snapshot when the monitor starts
        try {
            const snapshot = {}
            Object.keys(wsClients).forEach(key => {
                snapshot[key] = {
                    count: wsClients[key].length,
                    wsCpdatas: wsCpdatas[key] ? wsCpdatas[key][0] : null
                }
            })
            console.log('Initial OCPP connection snapshot:', JSON.stringify(snapshot))
        } catch (e) {
            console.log('Error creating initial snapshot', e)
        }

        res.send('ocpp connections monitor started')

    },

    /*
       功能: ocpp test
       方法: get
  
    */
    ocpp_cpid: async (req, res) => {
        console.log("into get_ocpp_cpid")
        const cpid = req.params.id
        var from = "benson:"
        const result = { succeed: true };
        console.log("send to cpid:"+cpid)
        if(wsClients[cpid] !== undefined) {
            wsClients[cpid].forEach((client) => {
                client.send(JSON.stringify({
                    from,
                    content: "slkerjw"
                }));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        res.json(result);

    },

    /*
       功能: ocpp_stop_charging
       方法: get
  
    */
    ocpp_stop_charging: async (req, res) => {
        console.log("into get_ocpp_stop_charging")
        const cpid = req.params.cpid
        const result = { succeed: true };

        var  ocpp_id_send="bensoncsms-101-ocpp-send";
        var tt_obj=[2,ocpp_id_send,"TriggerMessage",{"connectorId":1,"requestedMessage":"StatusNotification"}]
        console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
        console.log('send to cpid:'+cpid+"params.cmd="+req.params.cmd)

        if(wsClients[cpid] !== undefined) {
            wsClients[cpid].forEach((client) => {
                client.send(JSON.stringify(tt_obj));
            });
        } else {
            // 如果消息接收方没有连接，则返回错误信息
            result.succeed = false;
            result.msg = '对方不在线';
        }
        res.json(result);

    },

    /*
       功能: ocpp_send_cmd
       方法: POST
       參數: email, password
    */
    ocpp_send_cmd: async (req, res) => {
        console.log("into ocpp_send_cmd")
        try {
            const { cpid, cmd } = req.body
            console.log("ocpp_send_cmd_cpid:"+cpid)
            console.log("ocpp_send_cmd_cmd:"+cmd)


        } catch (e) {
            console.log(e)
        }
    },

    /*
       功能: ocpp test
       方法: get
  
    */
    ocpp_ws: async (ws, req) => {
        console.log('连接成功')
        
        const id = req.params.id;
        console.log(`[WebSocket] 🔌 充電站 ${id} 建立連線`);
        
        // 更新充電站連線狀態
        updateStationOnlineStatus(id);
        
//const cpsn = await Order.findOne({ where: { id : 1 } })
        // const cpsn = read_data()
        var ocpp_message="";
        var jj_data=JSON.stringify(ws);
        console.log("req.params="+req.params.id);
        //      console.log("req.all="+jj_data);
        if(!wsClients[req.params.id]) {
            wsClients[req.params.id] = []
        }
        if(!wsCpdatas[req.params.id]) {
            wsCpdatas[req.params.id] = []
        }
        // 将连接记录在连接池中
        wsClients[req.params.id].push(ws);
        console.log("wsClients="+JSON.stringify(wsClients));

        // 在 WebSocket 初始化時直接從資料庫取得 cpid mapping
        console.log(`[WebSocket初始化] 🔍 查詢充電站 ${req.params.id} 的 cpid 映射...`);
        
        let cpidMapping1 = "";
        let cpidMapping2 = "";
        let cpidMapping3 = "";
        let cpidMapping4 = "";
        
        try {
            // 直接查詢資料庫取得所有 connector 的 cpid 映射
            const { databaseService: dbService } = await loadDatabaseModules();
            const guns1 = await dbService.getGuns({ cpsn: req.params.id, connector: "1" });
            const guns2 = await dbService.getGuns({ cpsn: req.params.id, connector: "2" });
            const guns3 = await dbService.getGuns({ cpsn: req.params.id, connector: "3" });
            const guns4 = await dbService.getGuns({ cpsn: req.params.id, connector: "4" });
            
            cpidMapping1 = guns1.length > 0 ? guns1[0].cpid : "";
            cpidMapping2 = guns2.length > 0 ? guns2[0].cpid : "";
            cpidMapping3 = guns3.length > 0 ? guns3[0].cpid : "";
            cpidMapping4 = guns4.length > 0 ? guns4[0].cpid : "";
            
            console.log(`[WebSocket初始化] ✅ 充電站 ${req.params.id} cpid 映射結果:`);
            console.log(`[WebSocket初始化]   - Connector 1: ${cpidMapping1 || '未設定'}`);
            console.log(`[WebSocket初始化]   - Connector 2: ${cpidMapping2 || '未設定'}`);
            console.log(`[WebSocket初始化]   - Connector 3: ${cpidMapping3 || '未設定'}`);
            console.log(`[WebSocket初始化]   - Connector 4: ${cpidMapping4 || '未設定'}`);
            
        } catch (error) {
            console.error(`[WebSocket初始化] ❌ 查詢 ${req.params.id} cpid 映射失敗:`, error);
            // 保持空字串作為 fallback
        }

        var socket_cp_data ={
            cpsn: req.params.id,
            cp_online: "online",
            cp_vendor : "",
            cp_model : "",
            memo1 :  "",
            memo2 : "",
            heartbeat : "",

            connector_1_meter:{
                cpid_mapping : cpidMapping1,
                current_status: "",
                charging_start_time : "",
                charging_stop_time : "",
                last_total_time : "",
                last_kwh : "",
                data1: "0.00",
                data2: "0.00",
                data3: "0.00",
                data4: "0.00",
                data5: "0.00",
                data6: "0.00"
            },
            connector_2_meter:{
                cpid_mapping : cpidMapping2,
                current_status: "",
                charging_start_time : "",
                charging_stop_time : "",
                last_total_time : "",
                last_kwh : "",
                data1: "0.00",
                data2: "0.00",
                data3: "0.00",
                data4: "0.00",
                data5: "0.00",
                data6: "0.00"
            },
            connector_3_meter:{
                cpid_mapping : cpidMapping3,
                current_status: "",
                charging_start_time : "",
                charging_stop_time : "",
                last_total_time : "",
                last_kwh : "",
                data1: "0.00",
                data2: "0.00",
                data3: "0.00",
                data4: "0.00",
                data5: "0.00",
                data6: "0.00"
            },
            connector_4_meter:{
                cpid_mapping : cpidMapping4,
                current_status: "",
                charging_start_time : "",
                charging_stop_time : "",
                last_total_time : "",
                last_kwh : "",
                data1: "0.00",
                data2: "0.00",
                data3: "0.00",
                data4: "0.00",
                data5: "0.00",
                data6: "0.00"
            }
        }

        wsCpdatas[req.params.id].push(socket_cp_data);
        console.log(`[WebSocket初始化] 📊 充電站 ${req.params.id} 初始化完成`);
        console.log("wsCpdatas_socket_cp_data_cpid="+JSON.stringify(wsCpdatas[req.params.id][0].cpsn));

//start of ws.on message
        ws.on('message', data => {
            //data 為 Client 發送的訊息，現在將訊息原封不動發送出去
            console.log("message="+req.params.id+data );
            ocpp_message = data;
            //   ws.send("server_feedback:"+req.params.id+":"+data)
            // find cpsn
            //   const cpsn = (async () =>{ await Order.findOne({ where: { id : 1 } }) })();
            //   console.log("read_Cp_gun_datas="+JSON.stringify(cpsn));
            //  update_guns_data(id,"1","Charging")
            // 建立 cp log (通用日誌，cpid 使用 cpsn 作為標識)
            (async () => {
                try {
                    const { createCpLog: logFunction } = await loadDatabaseModules();
                    await logFunction({
                        cpid: getStationPrimaryCpid(id), // 使用充電站的主要 cpid
                        cpsn: id,
                        log: ocpp_message,
                        time: new Date(),
                        inout: "in",
                    });
                } catch (err) {
                    console.error('記錄 CP log 失敗:', err);
                }
            })();
            if(id=="2022111407200005"){
                console.log("2022incoming:"+id );
                update_guns_memo2(id,1)
            }

            // start to ocpp
            var j_aa=JSON.parse(data)
            //[2,"863a9bae-e24d-795b-6a7f-6b5a32e09c69","BootNotification",{"chargePointVendor":"SpacePark","chargePointModel":"EU1060_TYPE_II","chargePointSerialNumber":"spacepark102","chargeBoxSerialNumber":"5D45CFF0362B41D7500100A3","firmwareVersion":"ACM4_EVSE_V12.38","meterType":"D1006BF"}]

            if(j_aa[2]=="BootNotification"){
                console.log('into BootNotification proc')
                wsCpdatas[req.params.id][0].cp_vendor = j_aa[3].chargePointVendor
                wsCpdatas[req.params.id][0].cp_model = j_aa[3].chargePointModel

                console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));

                // BootNotification 時主動建立 cpid_mapping 並等待完成
                console.log('[BootNotification] 🔧 初始化充電站 cpid 映射...');
                
                //2022-10-04T15:05:486Z
                var tt_obj=[3,"6677543",{
                    //  "registrationStatus":"Accepted"
                    "currentTime":"2022-10-04T15:05:486Z",
                    "interval":30,
                    "status":"Accepted"
                }]
                tt_obj[1]=j_aa[1]
                //     var cur_dateiso=new Date()+8 * 3600 * 1000
                now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                tt_obj[2].currentTime=now_time
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
                
                // 非同步建立 cpid 映射並記錄日誌
                const initializeCpidMapping = async () => {
                    try {
                        console.log('[BootNotification] 📡 開始建立 cpid 映射...');
                        
                        // 等待兩個 connector 的映射都完成
                        await Promise.all([
                            cpid_mapping(id, 1),
                            cpid_mapping(id, 2)
                        ]);
                        
                        console.log('[BootNotification] ✅ cpid 映射建立完成');
                        
                        // 現在可以安全地取得 cpid
                        const bootCpid = getStationPrimaryCpid(id);
                        console.log(`[BootNotification] 📋 記錄日誌 - CPID: ${bootCpid}, CPSN: ${id}`);
                        
                        createCpLog({
                            cpid: bootCpid,
                            cpsn: id,
                            log: JSON.stringify(tt_obj),
                            time: new Date(),
                            inout: "out",
                        });
                        
                    } catch (error) {
                        console.error('[BootNotification] ❌ cpid 映射建立失敗:', error);
                        
                        // 如果失敗，使用 cpsn 作為 fallback
                        console.log(`[BootNotification] 🔄 使用 fallback - CPID: ${id}, CPSN: ${id}`);
                        createCpLog({
                            cpid: id, // 使用 cpsn 作為 fallback
                            cpsn: id,
                            log: JSON.stringify(tt_obj),
                            time: new Date(),
                            inout: "out",
                        });
                    }
                };
                
                // 立即開始非同步初始化
                initializeCpidMapping();

            }

            if(j_aa[2]=="StatusNotification"){
                console.log('into "StatusNotification" proc')
//  [2,"53318fcc-2668-5a56-aaff-d741784db2d9","StatusNotification",{"connectorId":1,"errorCode":"NoError","status":"Charging"
                //  console.log('status='+j_aa[3].status)
                // status changed!!
                var thisconnector=j_aa[3].connectorId
                cpid_mapping( id , thisconnector );

                // 獲取正確的 cpid 用於日誌記錄
                const targetCpid = getCpidFromWsData(id, thisconnector);

                if(thisconnector==1){
                    wsCpdatas[req.params.id][0].connector_1_meter.current_status = j_aa[3].status
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                }
                if(thisconnector==2){
                    wsCpdatas[req.params.id][0].connector_2_meter.current_status = j_aa[3].status
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                }

                if(cp_current_status!=j_aa[3].status){
                    cp_current_status=j_aa[3].status;
                    //     cp_status_changed();
                }
                cp_current_status=j_aa[3].status;
                console.log('status='+cp_current_status)
                var tt_obj=[3,6677543,{}]
                tt_obj[1]=j_aa[1]
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
                ws.send(JSON.stringify(tt_obj))
                update_guns_status(id,j_aa[3].connectorId,j_aa[3].status)

                // 新增：事件驅動的功率配置更新機制
                // 當充電樁狀態發生變化時，觸發全站功率重新分配
                console.log('[事件驅動] 🔍 分析 StatusNotification 事件...');
                const chargingChange = detectChargingStatusChange('StatusNotification', j_aa[3]);
                
                if (chargingChange !== null) {
                    console.log(`[事件驅動] 📋 檢測到充電狀態變化: ${chargingChange ? '開始充電' : '停止充電'}`);
                    console.log(`[事件驅動-StatusNotification] ⚡ 充電站 ${id} connector ${thisconnector} 狀態變更為: ${j_aa[3].status}`);
                    
                    // 觸發全站功率重新分配，而非單一充電樁
                    console.log(`[事件驅動-StatusNotification] 🚀 觸發全站功率重新分配...`);
                    scheduleGlobalPowerReallocation('StatusNotification', { 
                        triggerCpsn: id, 
                        triggerConnector: thisconnector,
                        newStatus: j_aa[3].status 
                    });
                } else {
                    console.log(`[事件驅動] ℹ️  StatusNotification 狀態變化不需要功率重新分配: ${j_aa[3].status}`);
                }
                /*
            Cp_log.create({
                  // id: 2,
                   cpid: id,
                   cpsn: id,
                   log: JSON.stringify(tt_obj),
                   time: new Date(),
                   inout: "out",
                 })

                  */
            }
            if(j_aa[2]=="Heartbeat"){
                console.log('into "Heartbeat" proc')

                var tt_obj=[3,6677543,{"currentTime":"2022-10-04T15:05:486Z"}]
                tt_obj[1]=j_aa[1]
                now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                tt_obj[2].currentTime=now_time
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))

                wsCpdatas[req.params.id][0].heartbeat = now_time
                console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));


                createCpLog({
                    cpid: getStationPrimaryCpid(id), // 使用充電站的主要 cpid
                    cpsn: id,
                    log: JSON.stringify(tt_obj),
                    time: new Date(),
                    inout: "out",
                })

            }

            if(j_aa[2]=="Authorize"){
                console.log('into "Authorize" proc')

                var tt_obj=[3,6677543,{"idTagInfo":{"status":"Accepted"}}]
                tt_obj[1]=j_aa[1]
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
                createCpLog({
                    cpid: getStationPrimaryCpid(id), // 使用充電站的主要 cpid
                    cpsn: id,
                    log: JSON.stringify(tt_obj),
                    time: new Date(),
                    inout: "out",
                })
            }

            if(j_aa[2]=="StartTransaction"){
                console.log('into "StartTransaction" proc')
                //[2,"fdb09c01-ba68-7ac4-5f05-8687dfa317d9","StartTransaction",{"connectorId":1,"idTag":"wang1234","meterStart":0,"timestamp":"2024-01-23T14:44:08.001Z"}]
                //expiryDate=taipei time + 24h
                var thisconnector=j_aa[3].connectorId
                console.log('start_connectorid:'+thisconnector)
                if(thisconnector==1){
                    trans_id=1111;
                    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                    wsCpdatas[req.params.id][0].connector_1_meter.charging_start_time = now_time
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                }
                if(thisconnector==2){
                    trans_id=2222;
                    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                    wsCpdatas[req.params.id][0].connector_2_meter.charging_start_time = now_time
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));

                }
                exp_time=new Date(+new Date() + 8 * 3600 * 1000 * 24).toISOString()
                //     var tt_obj=[3,6677543,{"idTagInfo":{"expiryDate":exp_time,"status":"Accepted","transactionId":trans_id}}]
                var tt_obj=[3,6677543,{"idTagInfo":{"expiryDate":exp_time,"status":"Accepted"},"transactionId":trans_id}]

                tt_obj[1]=j_aa[1]
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))

                // 新增：事件驅動的功率配置更新機制
                // StartTransaction 是最明確的充電開始信號，觸發全站重新分配
                console.log('[事件驅動] 🔍 處理 StartTransaction 事件...');
                console.log(`[事件驅動] 📊 交易資訊:`);
                console.log(`[事件驅動]   - 充電站: ${id}`);
                console.log(`[事件驅動]   - 連接器: ${thisconnector}`);
                console.log(`[事件驅動]   - 交易ID: ${trans_id}`);
                console.log(`[事件驅動]   - ID標籤: ${j_aa[3].idTag}`);
                
                console.log(`[事件驅動-StartTransaction] ⚡ 充電交易開始，觸發全站功率重新分配`);
                scheduleGlobalPowerReallocation('StartTransaction', { 
                    triggerCpsn: id, 
                    triggerConnector: thisconnector,
                    transactionId: trans_id,
                    idTag: j_aa[3].idTag 
                });

                // 為 StartTransaction 使用正確的 cpid
                const startTxCpid = getCpidFromWsData(id, thisconnector) || id; // 確保有值
                createCpLog({
                    cpid: startTxCpid, // 使用對應的 cpid
                    cpsn: id,
                    log: JSON.stringify(tt_obj),
                    time: new Date(),
                    inout: "out",
                })
            }

//[2,"02293dfb-99a3-25bc-e807-63f839b15602","StopTransaction",
//{"idTag":"wang1234","meterStop":172,"timestamp":"2024-02-06T01:05:19.001Z","transactionId":2222,"reason":"EVDisconnected"}]

            if(j_aa[2]=="StopTransaction"){
                console.log('into "StopTransaction" proc')
                if(j_aa[3].transactionId==1111){
                    update_guns_status(id,1,"Finishing");
                    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                    wsCpdatas[req.params.id][0].connector_1_meter.charging_stop_time = now_time
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));

                }
                if(j_aa[3].transactionId==2222){
                    update_guns_status(id,2,"Finishing");
                    now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                    wsCpdatas[req.params.id][0].connector_2_meter.charging_start_time = now_time
                    console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));

                }

                //expiryDate=taipei time + 24h
                exp_time=new Date(+new Date() + 8 * 3600 * 1000 * 24).toISOString()
                var tt_obj=[3,6677543,{}]
                tt_obj[1]=j_aa[1]
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))

                now_time=new Date(+new Date() + 8 * 3600 * 1000).toISOString()
                wsCpdatas[req.params.id][0].charging_stop_time = now_time
                console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));

                // 新增：事件驅動的功率配置更新機制
                // StopTransaction 是充電結束的明確信號，觸發全站重新分配
                console.log('[事件驅動] 🔍 處理 StopTransaction 事件...');
                
                const transactionId = j_aa[3].transactionId;
                const connector = transactionId === 1111 ? 1 : 2;
                
                console.log(`[事件驅動] 📊 交易結束資訊:`);
                console.log(`[事件驅動]   - 充電站: ${id}`);
                console.log(`[事件驅動]   - 交易ID: ${transactionId}`);
                console.log(`[事件驅動]   - 推斷連接器: ${connector}`);
                console.log(`[事件驅動]   - 結束原因: ${j_aa[3].reason || '未指定'}`);
                console.log(`[事件驅動]   - 最終電表讀數: ${j_aa[3].meterStop}`);
                
                console.log(`[事件驅動-StopTransaction] ⚡ 充電交易結束，觸發全站功率重新分配`);
                scheduleGlobalPowerReallocation('StopTransaction', { 
                    triggerCpsn: id, 
                    triggerConnector: connector,
                    transactionId: transactionId,
                    reason: j_aa[3].reason,
                    meterStop: j_aa[3].meterStop 
                });

                // 為 StopTransaction 使用正確的 cpid
                const stopTxCpid = getCpidFromWsData(id, connector) || id; // 確保有值
                createCpLog({
                    cpid: stopTxCpid, // 使用對應的 cpid
                    cpsn: id,
                    log: JSON.stringify(tt_obj),
                    time: new Date(),
                    inout: "out",
                })
            }

            if(j_aa[2] === "DataTransfer") {
                console.log('into "DataTransfer" proc');

                const payload = j_aa[3]; // 第四個元素是 JSON 物件

                // 判斷 vendorId
                if(payload.vendorId === "efaner") {
                    console.log(`[DataTransfer] 收到 efaner 請求，尋找 CPSN=${id} 的對應 CPID`);
                    
                    // 尋找當前充電站的 CPID
                    const findCpidForStation = async () => {
                        try {
                            // 使用資料庫服務查詢 CPID
                            const { databaseService: dbService } = await loadDatabaseModules();
                            // 使用 CPSN 查詢對應的 CPID
                            const result = await dbService.getGuns({ cpsn: id });
                            
                            if (result && result.length > 0 && result[0].cpid) {
                                return result[0].cpid; // 返回找到的 CPID
                            } else {
                                console.log(`[DataTransfer] ⚠️ 找不到 CPSN=${id} 的對應 CPID，使用 CPSN 作為回應`);
                                return id; // 如果找不到 CPID，使用 CPSN 作為回應
                            }
                        } catch (error) {
                            console.error(`[DataTransfer] ❌ 查詢 CPID 時發生錯誤:`, error);
                            return id; // 發生錯誤時，使用 CPSN 作為 fallback
                        }
                    };
                    
                    // 查詢 CPID 並回應
                    findCpidForStation().then(cpid => {
                        console.log(`[DataTransfer] ✅ 為 CPSN=${id} 找到對應 CPID=${cpid}`);
                        
                        // 回傳找到的 CPID 作為 data
                        const tt_obj = [3, j_aa[1], { status: "Accepted", data: cpid }];
                        ws.send(JSON.stringify(tt_obj));
                        console.log('send_to_ev_charger_json with efaner:', JSON.stringify(tt_obj));
                        
                        // 記錄 log
                        createCpLog({
                            cpid: cpid,
                            cpsn: id,
                            log: JSON.stringify(tt_obj),
                            time: new Date(),
                            inout: "out",
                        });
                    });
                } else {
                    // 原本的 DataTransfer 流程
                    const exp_time = new Date(+new Date() + 8 * 3600 * 1000 * 24).toISOString();
                    const tt_obj = [3, j_aa[1], { status: "Accepted" }];
                    ws.send(JSON.stringify(tt_obj));
                    console.log('send_to_ev_charger_json with default:', JSON.stringify(tt_obj));

                    createCpLog({
                        cpid: getStationPrimaryCpid(id),
                        cpsn: id,
                        log: JSON.stringify(tt_obj),
                        time: new Date(),
                        inout: "out",
                    });
                }
            }

            if(j_aa[2]=="MeterValues"){
                console.log('into "MeterValues" proc')

                console.log("now in metervalues id="+id);

                if(id[0]=="T" && id[1]=="A" && id[2]=="C"){
                    console.log("this is ABB's meters");
                    var meter_connectorid=j_aa[3].connectorId
                    var meter_transactionid= j_aa[3].transactionId
                    console.log('metervalue_connectorid:'+meter_connectorid);
                    console.log('metervalue_transactionid:'+meter_transactionid);
                    
                    // 安全檢查 sampledValue 陣列長度
                    const sampledValues = j_aa[3].meterValue[0].sampledValue;
                    console.log(`[MeterValues] 收到 ${sampledValues.length} 個 sampledValue:`, JSON.stringify(sampledValues));
                    
                    // 初始化數據變數
                    let cp_data1 = "0.00"; // kWh
                    let cp_data2 = "0.00"; // Current (A)
                    let cp_data3 = "0.00"; // Voltage (V)
                    let cp_data4 = "0.00"; // Power (kW)
                    
                    // 根據實際收到的數據解析
                    for (let i = 0; i < sampledValues.length; i++) {
                        const sample = sampledValues[i];
                        console.log(`[MeterValues] sampledValue[${i}]:`, JSON.stringify(sample));
                        
                        if (sample.measurand === "Energy.Active.Import.Register") {
                            cp_data1 = (parseFloat(sample.value) / 1000).toFixed(3); // Wh -> kWh
                        } else if (sample.measurand === "Current.Import" || sample.measurand === "Current") {
                            cp_data2 = parseFloat(sample.value).toFixed(2);
                        } else if (sample.measurand === "Voltage") {
                            cp_data3 = parseFloat(sample.value).toFixed(2);
                        } else if (sample.measurand === "Power.Active.Import") {
                            cp_data4 = parseFloat(sample.value).toFixed(3);
                        }
                    }
                    
                    // 如果沒有直接的功率讀數，計算功率 (V * A / 1000)
                    if (cp_data4 === "0.00" && cp_data2 !== "0.00" && cp_data3 !== "0.00") {
                        cp_data4 = (parseFloat(cp_data2) * parseFloat(cp_data3) / 1000).toFixed(3);
                    }
                    
                    console.log('metervalue_In-charging kWh_cp_data1:'+cp_data1);
                    console.log('metervalue_In-charging A_cp_data2:'+cp_data2);
                    console.log('metervalue_In-charging V_cp_data3:'+cp_data3);
                    console.log('metervalue_In-charging power_cp_data4:'+cp_data4);
                    if(j_aa[3].connectorId==1){
                        wsCpdatas[req.params.id][0].connector_1_meter.data1 = cp_data1
                        wsCpdatas[req.params.id][0].connector_1_meter.data2 = cp_data2
                        wsCpdatas[req.params.id][0].connector_1_meter.data3 = cp_data3
                        wsCpdatas[req.params.id][0].connector_1_meter.data4 = cp_data4
                        wsCpdatas[req.params.id][0].connector_1_meter.data5 = "0.00" // 修復未定義的變數
                        console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                    }
                    update_guns_meters(req.params.id,meter_connectorid,cp_data1,cp_data2,cp_data3,cp_data4)

                }
                if(id[0]=="s" && id[1]=="p"){
                    console.log("this is spacepark's meters");

                    var meter_connectorid=j_aa[3].connectorId
                    var meter_transactionid= j_aa[3].transactionId
                    console.log('metervalue_connectorid:'+meter_connectorid);
                    console.log('metervalue_transactionid:'+meter_transactionid);
                    if(j_aa[3].meterValue[0].sampledValue[0].unit=="Wh"){
                        cp_data1 = j_aa[3].meterValue[0].sampledValue[0].value
                        cp_data1 = cp_data1/1000
                        cp_data1 = cp_data1.toFixed(3)
                        console.log('metervalue_No-charging_Wh:'+cp_data1);
                        //console.log('metervalue_No-charging_kWh:'+cp_data1/1000);
                        cp_data2 = "0.00";
                        cp_data3 = "0.0";
                        cp_data4 = "0.0";

                        if(j_aa[3].connectorId==1){
                            wsCpdatas[req.params.id][0].connector_1_meter.data1 = cp_data1
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }
                        if(j_aa[3].connectorId==2){
                            wsCpdatas[req.params.id][0].connector_2_meter.data1 = cp_data1
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }

                    } else {
                        cp_data1 =  j_aa[3].meterValue[0].sampledValue[1].value
                        cp_data1 = cp_data1/1000
                        cp_data2 =  j_aa[3].meterValue[0].sampledValue[0].value
                        cp_data3 =  j_aa[3].meterValue[0].sampledValue[3].value
                        cp_data1 = cp_data1.toFixed(3)
                        cp_data4 = cp_data2*cp_data3;
                        cp_data4 = cp_data4.toFixed(3)
                        console.log('metervalue_In-charging khw_cp_data1:'+cp_data1);
                        console.log('metervalue_In-charging A_cp_data2:'+cp_data2);
                        console.log('metervalue_In-charging V_cp_data3:'+cp_data3);
                        console.log('metervalue_In-charging power_cp_data4:'+cp_data4);
                        if(j_aa[3].connectorId==1){
                            wsCpdatas[req.params.id][0].connector_1_meter.data1 = cp_data1
                            wsCpdatas[req.params.id][0].connector_1_meter.data2 = cp_data2
                            wsCpdatas[req.params.id][0].connector_1_meter.data3 = cp_data3
                            wsCpdatas[req.params.id][0].connector_1_meter.data4 = cp_data4
                            wsCpdatas[req.params.id][0].connector_1_meter.data5 = cp_data5
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }
                        if(j_aa[3].connectorId==2){
                            wsCpdatas[req.params.id][0].connector_2_meter.data1 = cp_data1
                            wsCpdatas[req.params.id][0].connector_2_meter.data2 = cp_data2
                            wsCpdatas[req.params.id][0].connector_2_meter.data3 = cp_data3
                            wsCpdatas[req.params.id][0].connector_2_meter.data4 = cp_data4
                            wsCpdatas[req.params.id][0].connector_2_meter.data5 = cp_data5
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }

                    }

                    update_guns_meters(req.params.id,meter_connectorid,cp_data1,cp_data2,cp_data3,cp_data4)
                }
                if(id[0]=="G" && id[1]=="S"){
                    console.log("GSGSGSGSGSGSGS---------------------this is GS's meters");
                    console.log("GSGSGSGSGSGSGS---------------------this is GS's meters");
                    console.log("GSGSGSGSGSGSGS---------------------this is GS's meters");
                    console.log("GSGSGSGSGSGSGS---------------------this is GS's meters");
                    console.log("GSGSGSGSGSGSGS---------------------this is GS's meters");

                    console.log('metervalue_[0]:'+j_aa[3].meterValue[0].sampledValue[0].value);
                    console.log('metervalue_[1]:'+j_aa[3].meterValue[0].sampledValue[1].value);
                    console.log('metervalue_[2]:'+j_aa[3].meterValue[0].sampledValue[2].value);
                    console.log('metervalue_[3]:'+j_aa[3].meterValue[0].sampledValue[3].value);
                    console.log('metervalue_[4]:'+j_aa[3].meterValue[0].sampledValue[4].value);
                    console.log('metervalue_[5]:'+j_aa[3].meterValue[0].sampledValue[5].value);
                    console.log('metervalue_[6]:'+j_aa[3].meterValue[0].sampledValue[6].value);
                    console.log('metervalue_[7]:'+j_aa[3].meterValue[0].sampledValue[7].value);
                    console.log('metervalue_[8]:'+j_aa[3].meterValue[0].sampledValue[8].value);
                    console.log('metervalue_[9]:'+j_aa[3].meterValue[0].sampledValue[9].value);

                    var meter_connectorid=j_aa[3].connectorId
                    var meter_transactionid= j_aa[3].transactionId
                    console.log('metervalue_connectorid:'+meter_connectorid);
                    console.log('metervalue_transactionid:'+meter_transactionid);
                    if(j_aa[3].meterValue[0].sampledValue[0].unit=="Wh"){
                        cp_data1 = j_aa[3].meterValue[0].sampledValue[0].value
                        // alex said it to 100 to test
                        // /1000 is for kwh
                        cp_data1 = cp_data1/1000
                        cp_data1 = cp_data1.toFixed(3)
                        console.log('metervalue_No-charging_Wh:'+cp_data1);
                        //console.log('metervalue_No-charging_kWh:'+cp_data1/1000);
                        cp_data2 = "0.00";
                        cp_data3 = "0.0";
                        cp_data4 = "0.0";

                        if(j_aa[3].connectorId==1){
                            wsCpdatas[req.params.id][0].connector_1_meter.data1 = cp_data1
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }
                        if(j_aa[3].connectorId==2){
                            wsCpdatas[req.params.id][0].connector_2_meter.data1 = cp_data1
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }

                    } else {
                        // alex said it to 100 to test
                        cp_data1 =  j_aa[3].meterValue[0].sampledValue[4].value
                        cp_data1 = cp_data1/1000
                        cp_data2 =  j_aa[3].meterValue[0].sampledValue[0].value
                        cp_data3 =  j_aa[3].meterValue[0].sampledValue[7].value
                        cp_data1 = cp_data1.toFixed(3)
                        cp_data4 = cp_data2*cp_data3;
                        cp_data4 = cp_data4.toFixed(3)
                        console.log('metervalue_In-charging khw_cp_data1:'+cp_data1);
                        console.log('metervalue_In-charging A_cp_data2:'+cp_data2);
                        console.log('metervalue_In-charging V_cp_data3:'+cp_data3);
                        console.log('metervalue_In-charging power_cp_data4:'+cp_data4);
                        if(j_aa[3].connectorId==1){
                            wsCpdatas[req.params.id][0].connector_1_meter.data1 = cp_data1
                            wsCpdatas[req.params.id][0].connector_1_meter.data2 = cp_data2
                            wsCpdatas[req.params.id][0].connector_1_meter.data3 = cp_data3
                            wsCpdatas[req.params.id][0].connector_1_meter.data4 = cp_data4
                            wsCpdatas[req.params.id][0].connector_1_meter.data5 = cp_data5
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }
                        if(j_aa[3].connectorId==2){
                            wsCpdatas[req.params.id][0].connector_2_meter.data1 = cp_data1
                            wsCpdatas[req.params.id][0].connector_2_meter.data2 = cp_data2
                            wsCpdatas[req.params.id][0].connector_2_meter.data3 = cp_data3
                            wsCpdatas[req.params.id][0].connector_2_meter.data4 = cp_data4
                            wsCpdatas[req.params.id][0].connector_2_meter.data5 = cp_data5
                            console.log("wsCpdatas_all="+JSON.stringify(wsCpdatas[req.params.id][0]));
                        }

                    }

                    update_guns_meters(req.params.id,meter_connectorid,cp_data1,cp_data2,cp_data3,cp_data4)
                }


                var tt_obj=[3,6677543,{"status":"Accepted"}]
                tt_obj[1]=j_aa[1]
                ws.send(JSON.stringify(tt_obj))
                console.log('send_to_ev_charger_json:'+JSON.stringify(tt_obj))
                
                // MeterValues 包含 connectorId，取得對應的 cpid
                const meterValueCpid = getCpidFromWsData(id, meter_connectorid) || id; // 確保有值
                createCpLog({
                    cpid: meterValueCpid, // 使用 connectorId 取得對應的 cpid
                    cpsn: id,
                    log: JSON.stringify(tt_obj),
                    time: new Date(),
                    inout: "out",
                })
                //get_ocpp_4_data();
            }


//end of ws.on message
        })

        ws.onclose = () => {
            const cpsn = req.params.id;
            console.log(`[WebSocket] 🔌 充電站 ${cpsn} 連線斷開`);
            
            // 连接关闭时，wsClients进行清理
            wsClients[cpsn] = wsClients[cpsn].filter((client) => {
                return client !== ws;
            });
            
            // 如果該充電站沒有其他連線，則更新充電樁狀態為離線
            if(wsClients[cpsn].length === 0) {
                console.log(`[WebSocket] ❌ 充電站 ${cpsn} 所有連線已斷開，更新充電樁狀態為離線`);
                delete wsClients[cpsn];
                
                // 更新該充電站下所有充電樁的狀態為離線
                updateStationOfflineStatus(cpsn);
            } else {
                console.log(`[WebSocket] ⚠️  充電站 ${cpsn} 仍有 ${wsClients[cpsn].length} 個連線保持`);
            }
            
            // 清理充電站數據
            delete wsCpdatas[cpsn];
        }



    },
}
/**
 * @deprecated 
 */
async function update_guns_status(gun_cpsn, gun_connector, new_status) {
    try {
        const { databaseService: dbService } = await loadDatabaseModules();
        const guns = await dbService.getGuns({ cpsn: gun_cpsn, connector: String(gun_connector) });
        const gun = guns.length > 0 ? guns[0] : null;
        if (!gun) {
            console.log('update_guns_status: gun not found', gun_cpsn, gun_connector);
            return 0;
        }
        const now_time = new Date(+new Date() + 8 * 3600 * 1000).toISOString();
        await dbService.updateGun(gun.id, {
            guns_status: new_status,
            guns_memo2: now_time,
            updatedAt: new Date()
        });
        console.log(`update_guns_status: updated ${gun.cpid} connector ${gun.connector} -> ${new_status}`);
        return 1;
    } catch (e) {
        console.error('update_guns_status error', e);
        return 0;
    }
}
/**
 * @deprecated 
 */
module.exports = ocppController
