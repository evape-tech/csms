/**
 * EMS 分配演算法完整測試套件
 * 限縮測試範圍：
 * - 樁數: 0-50台
 * - 場域總瓦數: 0-480kW
 * - AC/DC混合搭配: AC(7kW/11kW), DC(120kW/180kW)
 * - 約束條件: AC≥6A, DC≥1kW
 * - 動態模式: 充電槍需盡量滿配負載
 */

const { calculateEmsAllocation, isCharging } = require('../src/lib/emsAllocator');
const fs = require('fs');
const path = require('path');

// 測試結果收集器
let testResults = [];
let testStartTime = Date.now();

// 輔助函數：生成測試用充電槍
function generateGuns(ac7Count, ac11Count, dc120Count, dc180Count, chargingIndices = []) {
  const guns = [];
  let id = 1;
  
  for (let i = 0; i < ac7Count; i++) {
    guns.push({
      id: id++,
      cpid: `AC7_${id-1}`,
      cpsn: `station_${id-1}`,
      connector: 'Type2',
      acdc: 'AC',
      max_kw: 7,
      guns_status: chargingIndices.includes(id-1) ? 'charging' : 'standby'
    });
  }
  
  for (let i = 0; i < ac11Count; i++) {
    guns.push({
      id: id++,
      cpid: `AC11_${id-1}`,
      cpsn: `station_${id-1}`,
      connector: 'Type2',
      acdc: 'AC',
      max_kw: 11,
      guns_status: chargingIndices.includes(id-1) ? 'charging' : 'standby'
    });
  }
  
  for (let i = 0; i < dc120Count; i++) {
    guns.push({
      id: id++,
      cpid: `DC120_${id-1}`,
      cpsn: `station_${id-1}`,
      connector: 'CCS1',
      acdc: 'DC',
      max_kw: 120,
      guns_status: chargingIndices.includes(id-1) ? 'charging' : 'standby'
    });
  }
  
  for (let i = 0; i < dc180Count; i++) {
    guns.push({
      id: id++,
      cpid: `DC180_${id-1}`,
      cpsn: `station_${id-1}`,
      connector: 'CCS1',
      acdc: 'DC',
      max_kw: 180,
      guns_status: chargingIndices.includes(id-1) ? 'charging' : 'standby'
    });
  }
  
  return guns;
}

// 輔助函數：記錄測試結果
function logTestResult(testName, sitePowerKw, guns, result, executionTime = 0) {
  const utilizationRate = sitePowerKw > 0 ? ((result.summary.total_allocated_kw / sitePowerKw) * 100) : 0;
  
  const testResult = {
    testNumber: testResults.length + 1,
    testName,
    sitePowerKw,
    gunCount: guns.length,
    gunConfig: {
      AC7: guns.filter(g => g.max_kw === 7 && g.acdc === 'AC').length,
      AC11: guns.filter(g => g.max_kw === 11 && g.acdc === 'AC').length,
      DC120: guns.filter(g => g.max_kw === 120 && g.acdc === 'DC').length,
      DC180: guns.filter(g => g.max_kw === 180 && g.acdc === 'DC').length
    },
    chargingStatus: {
      charging: guns.filter(g => g.guns_status === 'charging').length,
      standby: guns.filter(g => g.guns_status === 'standby').length
    },
    results: {
      mode: result.summary.mode || result.summary.ems_mode,
      totalAllocatedKw: result.summary.total_allocated_kw,
      utilizationRate: utilizationRate,
      withinLimit: result.summary.within_limit,
      executionTime
    },
    allocations: result.allocations.map(allocation => ({
      cpid: allocation.cpid,
      acdc: allocation.acdc,
      unit: allocation.unit,
      limit: allocation.limit,
      allocatedKw: allocation.allocated_kw,
      charging: allocation.charging || false
    }))
  };
  
  testResults.push(testResult);
  
  console.log(`\n🔍 ${testName}`);
  console.log(`場域功率: ${sitePowerKw}kW, 槍數: ${guns.length}支`);
  console.log(`總分配功率: ${result.summary.total_allocated_kw.toFixed(2)}kW`);
  console.log(`功率使用率: ${utilizationRate.toFixed(1)}%`);
  console.log(`運行模式: ${result.summary.mode || result.summary.ems_mode}`);
  console.log(`場域限制: ${result.summary.within_limit ? '符合' : '超出'}`);
  
  console.log('分配詳情:');
  result.allocations.forEach(allocation => {
    const chargingStatus = allocation.charging ? '[充電中]' : '[待機]';
    const statusDisplay = result.summary.ems_mode === 'dynamic' ? ` ${chargingStatus}` : '';
    if (allocation.acdc === 'AC') {
      console.log(`  ${allocation.cpid}: ${allocation.limit}A (${allocation.allocated_kw.toFixed(2)}kW)${statusDisplay}`);
    } else {
      console.log(`  ${allocation.cpid}: ${allocation.limit}W (${allocation.allocated_kw.toFixed(2)}kW)${statusDisplay}`);
    }
  });
}

// 生成測試報告
function generateTestReport() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(__dirname, '..', 'test-results', `ems-test-report-${timestamp}.md`);
  
  // 確保目錄存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 計算統計資訊
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.results.withinLimit).length;
  const failedTests = totalTests - passedTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  const utilizationRates = testResults
    .filter(t => t.sitePowerKw > 0)
    .map(t => t.results.utilizationRate);
  const maxUtilization = Math.max(...utilizationRates);
  const minUtilization = Math.min(...utilizationRates);
  const avgUtilization = (utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length);
  
  const totalPowerAllocated = testResults.reduce((sum, t) => sum + t.results.totalAllocatedKw, 0);
  const totalSitePower = testResults.reduce((sum, t) => sum + t.sitePowerKw, 0);
  const totalGuns = testResults.reduce((sum, t) => sum + t.gunCount, 0);
  const withinLimitCount = testResults.filter(t => t.results.withinLimit).length;
  
  // 測試分類統計
  const testsByCategory = {
    '基本約束驗證': testResults.filter(t => t.testName.includes('限制') || t.testName.includes('約束')).length,
    '場域功率限制驗證': testResults.filter(t => t.testName.includes('場域') || t.testName.includes('kW')).length,
    '靜態模式邏輯驗證': testResults.filter(t => t.testName.includes('AC優先') || t.testName.includes('比例')).length,
    '動態模式邏輯驗證': testResults.filter(t => t.testName.includes('動態模式') && (t.testName.includes('回退') || t.testName.includes('部分'))).length,
    '充電樁狀態動態測試': testResults.filter(t => 
      (t.testName.includes('充電') && (t.testName.includes('滿載') || t.testName.includes('混合') || t.testName.includes('大量') || t.testName.includes('極限') || t.testName.includes('最大化'))) ||
      t.testName.includes('狀態變化') || t.testName.includes('DC功率分配精確測試')
    ).length,
    'DC充電樁功率共享測試': testResults.filter(t => t.testName.includes('雙槍DC') || t.testName.includes('DC站點') || t.testName.includes('DC充電樁')).length,
    '邊界條件測試': testResults.filter(t => t.testName.includes('最大樁數') || t.testName.includes('超載')).length,
    '性能測試': testResults.filter(t => t.testName.includes('性能')).length,
    '數據類型測試': testResults.filter(t => t.testName.includes('單位')).length
  };
  
  let markdownContent = `# EMS 分配演算法測試報告

**執行時間**: ${now.toLocaleString('zh-TW')}

## 📊 測試總覽

- **總測試數**: ${totalTests}個
- **通過測試**: ${passedTests}個 ✅
- **失敗測試**: ${failedTests}個
- **成功率**: ${successRate}%

## 📈 統計資料

### 功率使用率
- **最高使用率**: ${maxUtilization.toFixed(1)}%
- **最低使用率**: ${minUtilization.toFixed(1)}%
- **平均使用率**: ${avgUtilization.toFixed(1)}%

### 功率分配
- **總分配功率**: ${totalPowerAllocated.toFixed(2)}kW
- **總場域功率**: ${totalSitePower.toFixed(2)}kW
- **總充電槍數**: ${totalGuns}支
- **場域限制符合率**: ${((withinLimitCount / totalTests) * 100).toFixed(1)}%

### 測試分類
`;

  Object.entries(testsByCategory).forEach(([category, count]) => {
    markdownContent += `- **${category}**: ${count}個測試\n`;
  });

  markdownContent += `\n## 📋 詳細測試結果

`;

  // 按分類組織測試結果
  const testsByCategory2 = {
    '基本約束驗證': testResults.filter(t => t.testName.includes('限制') || t.testName.includes('約束')),
    '場域功率限制驗證': testResults.filter(t => t.testName.includes('場域') || t.testName.includes('kW') || t.testName.includes('空')),
    '靜態模式邏輯驗證': testResults.filter(t => t.testName.includes('AC優先') || t.testName.includes('比例')),
    '動態模式邏輯驗證': testResults.filter(t => t.testName.includes('動態模式') && (t.testName.includes('回退') || t.testName.includes('部分'))),
    '充電樁狀態動態測試': testResults.filter(t => 
      (t.testName.includes('充電') && (t.testName.includes('滿載') || t.testName.includes('混合') || t.testName.includes('大量') || t.testName.includes('極限') || t.testName.includes('最大化'))) ||
      t.testName.includes('狀態變化') || t.testName.includes('DC功率分配精確測試')
    ),
    'DC充電樁功率共享測試': testResults.filter(t => t.testName.includes('雙槍DC') || t.testName.includes('DC站點') || t.testName.includes('DC充電樁')),
    '邊界條件測試': testResults.filter(t => t.testName.includes('最大樁數') || t.testName.includes('超載')),
    '性能測試': testResults.filter(t => t.testName.includes('性能')),
    '數據類型測試': testResults.filter(t => t.testName.includes('單位'))
  };

  Object.entries(testsByCategory2).forEach(([category, tests]) => {
    if (tests.length > 0) {
      markdownContent += `### ${category}\n\n`;
      
      tests.forEach(test => {
        const statusIcon = test.results.withinLimit ? '✅' : '⚠️';
        const chargingInfo = test.chargingStatus.charging > 0 ? 
          ` (充電中: ${test.chargingStatus.charging}支, 待機: ${test.chargingStatus.standby}支)` : '';
        
        markdownContent += `#### ${test.testNumber}. ${test.testName} ${statusIcon}\n\n`;
        markdownContent += `- **場域功率**: ${test.sitePowerKw}kW\n`;
        markdownContent += `- **充電槍數**: ${test.gunCount}支${chargingInfo}\n`;
        markdownContent += `- **槍配置**: AC7×${test.gunConfig.AC7}, AC11×${test.gunConfig.AC11}, DC120×${test.gunConfig.DC120}, DC180×${test.gunConfig.DC180}\n`;
        markdownContent += `- **總分配功率**: ${test.results.totalAllocatedKw.toFixed(2)}kW\n`;
        markdownContent += `- **功率使用率**: ${test.results.utilizationRate.toFixed(1)}%\n`;
        markdownContent += `- **場域限制**: ${test.results.withinLimit ? '符合' : '超出'}\n`;
        markdownContent += `- **運行模式**: ${test.results.mode === 'dynamic' ? '動態模式' : '靜態模式'}\n`;
        if (test.results.executionTime > 0) {
          markdownContent += `- **執行時間**: ${test.results.executionTime}ms\n`;
        }
        markdownContent += `\n`;
        
        if (test.allocations && test.allocations.length > 0) {
          markdownContent += `**分配詳情**:\n`;
          test.allocations.forEach(alloc => {
            const chargingStatus = alloc.charging ? ' [充電中]' : ' [待機]';
            const statusDisplay = test.results.mode === 'dynamic' ? chargingStatus : '';
            if (alloc.acdc === 'AC') {
              markdownContent += `- ${alloc.cpid}: ${alloc.limit}A (${alloc.allocatedKw.toFixed(2)}kW)${statusDisplay}\n`;
            } else {
              markdownContent += `- ${alloc.cpid}: ${alloc.limit}W (${alloc.allocatedKw.toFixed(2)}kW)${statusDisplay}\n`;
            }
          });
        }
        markdownContent += `\n`;
      });
    }
  });
  
  fs.writeFileSync(filePath, markdownContent, 'utf8');
  console.log(`\n📋 測試報告已保存至: ${filePath}`);
  console.log(`📊 測試總覽: ${totalTests}個測試，${passedTests}個通過，成功率${successRate}%`);
  console.log(`⚡ 功率使用率範圍: ${minUtilization.toFixed(1)}% - ${maxUtilization.toFixed(1)}%`);
  console.log(`📈 平均使用率: ${avgUtilization.toFixed(1)}%`);
  console.log(`🔋 總分配功率: ${totalPowerAllocated.toFixed(2)}kW`);
}

describe('EMS 分配演算法', () => {
  
  describe('基礎功能測試', () => {
    test('isCharging 函式應該正確識別充電狀態', () => {
      expect(isCharging('Charging')).toBe(true);
      expect(isCharging('charging')).toBe(true);
      expect(isCharging('CHARGING')).toBe(true);
      expect(isCharging('InUse')).toBe(true);
      expect(isCharging('Available')).toBe(false);
      expect(isCharging('Unavailable')).toBe(false);
      expect(isCharging('')).toBe(false);
      expect(isCharging(null)).toBe(false);
    });
  });

  describe('基本約束驗證', () => {
    test('AC最低6A限制', () => {
      const guns = generateGuns(1, 0, 0, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 1 }; // 極低功率
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('AC最低6A限制', 1, guns, result);
      
      expect(result.allocations[0].limit).toBeGreaterThanOrEqual(6); // AC最低6A
      expect(result.allocations[0].unit).toBe('A');
    });

    test('DC最低1kW限制', () => {
      const guns = generateGuns(0, 0, 1, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 0.5 }; // 極低功率
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('DC最低1kW限制', 0.5, guns, result);
      
      expect(result.allocations[0].limit).toBeGreaterThanOrEqual(1000); // DC最低1kW
      expect(result.allocations[0].unit).toBe('W');
    });

    test('11kW AC最大48A限制', () => {
      const guns = generateGuns(0, 1, 0, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 500 }; // 充足功率
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('11kW AC最大48A限制', 500, guns, result);
      
      expect(result.allocations[0].limit).toBeLessThanOrEqual(48); // AC最大48A
      expect(result.allocations[0].unit).toBe('A');
    });
  });

  describe('場域功率限制驗證', () => {
    test('0kW場域測試', () => {
      const guns = generateGuns(1, 0, 1, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 0 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('0kW場域測試', 0, guns, result);
      
      expect(result.allocations).toHaveLength(2);
      // 即使場域為0，也要給最低保證
      expect(result.allocations.find(a => a.acdc === 'AC').limit).toBe(6);
      expect(result.allocations.find(a => a.acdc === 'DC').limit).toBe(1000);
    });

    test('100kW場域測試', () => {
      const guns = generateGuns(5, 0, 1, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('100kW場域測試', 100, guns, result);
      
      expect(result.allocations).toHaveLength(6);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(100.1); // 允許小誤差
      expect(result.summary.within_limit).toBe(true);
    });

    test('250kW場域測試', () => {
      const guns = generateGuns(10, 5, 1, 1);
      const siteSetting = { ems_mode: 'static', max_power_kw: 250 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('250kW場域測試', 250, guns, result);
      
      expect(result.allocations).toHaveLength(17);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(250.1);
      expect(result.summary.within_limit).toBe(true);
    });

    test('480kW場域測試', () => {
      const guns = generateGuns(20, 10, 5, 5);
      const siteSetting = { ems_mode: 'static', max_power_kw: 480 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('480kW場域測試', 480, guns, result);
      
      expect(result.allocations).toHaveLength(40);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(480.1);
      expect(result.summary.within_limit).toBe(true);
    });

    test('空場域', () => {
      const guns = generateGuns(0, 0, 0, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('空場域', 100, guns, result);
      
      expect(result.allocations).toHaveLength(0);
      expect(result.summary.total_allocated_kw).toBe(0);
    });
  });

  describe('靜態模式邏輯驗證', () => {
    test('AC優先分配邏輯', () => {
      const guns = generateGuns(3, 0, 1, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('AC優先分配邏輯', 100, guns, result);
      
      expect(result.allocations).toHaveLength(4);
      // AC槍應該先獲得滿額分配
      const acAllocations = result.allocations.filter(a => a.acdc === 'AC');
      acAllocations.forEach(allocation => {
        expect(allocation.limit).toBeCloseTo(32, 0); // 約為7kW的滿額，允許小數誤差
      });
    });

    test('超載比例分配', () => {
      const guns = generateGuns(20, 0, 0, 0); // 20支AC槍
      const siteSetting = { ems_mode: 'static', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('超載比例分配', 100, guns, result);
      
      expect(result.allocations).toHaveLength(20);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(100.1);
      // 所有槍應該獲得相同的比例分配
      const firstAllocation = result.allocations[0];
      result.allocations.forEach(allocation => {
        expect(allocation.limit).toBe(firstAllocation.limit);
      });
    });
  });

  describe('動態模式邏輯驗證', () => {
    test('動態模式-回退靜態', () => {
      const guns = generateGuns(3, 0, 1, 0);
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid 而不是 cpsn
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 200 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('動態模式-回退靜態', 200, guns, result);
      
      expect(result.allocations).toHaveLength(4);
      // 沒有充電槍時應該回退到靜態模式
      expect(result.summary.ems_mode).toBe('static');
    });

    test('動態模式-部分充電', () => {
      const guns = generateGuns(5, 0, 1, 0);
      guns[0].guns_status = 'charging';
      guns[2].guns_status = 'charging';
      guns[5].guns_status = 'charging'; // DC槍充電
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid 而不是 cpsn
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 200 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('動態模式-部分充電', 200, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      
      // 驗證充電槍獲得優先分配
      const chargingAllocations = result.allocations.filter(a => a.charging);
      const nonChargingAllocations = result.allocations.filter(a => !a.charging);
      
      expect(chargingAllocations.length).toBe(3);
      
      // 充電槍應該獲得更多功率
      const chargingDC = chargingAllocations.find(a => a.acdc === 'DC');
      expect(chargingDC.limit).toBeGreaterThan(1000); // 超過最低限制
    });
  });

  describe('充電樁狀態動態測試', () => {
    test('單一AC槍充電-滿載', () => {
      const guns = generateGuns(3, 0, 0, 0, [1]); // 第1支槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 50 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('單一AC槍充電-滿載', 50, guns, result);
      
      const chargingGun = result.allocations.find(a => a.charging);
      expect(chargingGun).toBeDefined();
      expect(chargingGun.limit).toBe(32); // 滿額分配
    });

    test('混合AC/DC槍充電', () => {
      const guns = generateGuns(4, 2, 2, 1, [1, 5, 7, 9]); // 多支槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 300 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('混合AC/DC槍充電', 300, guns, result);
      
      const chargingAllocations = result.allocations.filter(a => a.charging);
      expect(chargingAllocations.length).toBe(4);
      expect(result.summary.within_limit).toBe(true);
    });

    test('充電樁狀態變化測試', () => {
      const guns = generateGuns(6, 0, 2, 0, [1, 3, 7]); // 部分槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 200 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('充電樁狀態變化測試', 200, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      const chargingCount = result.allocations.filter(a => a.charging).length;
      expect(chargingCount).toBe(3);
    });

    test('大量AC槍充電', () => {
      const guns = generateGuns(15, 0, 0, 0, [1, 3, 5, 7, 9, 11, 13, 15]); // 多支AC槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 150 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('大量AC槍充電', 150, guns, result);
      
      expect(result.allocations).toHaveLength(15);
      expect(result.summary.within_limit).toBe(true);
    });

    test('大量DC槍充電', () => {
      const guns = generateGuns(0, 0, 8, 4, [1, 3, 5, 7, 9, 11]); // 多支DC槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 400 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('大量DC槍充電', 400, guns, result);
      
      expect(result.allocations).toHaveLength(12);
      expect(result.summary.within_limit).toBe(true);
    });

    test('極限充電情況', () => {
      const guns = generateGuns(5, 0, 3, 0, [1, 2, 3, 6, 7]); // 多支槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 100 }; // 功率不足
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('極限充電情況', 100, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      const chargingCount = result.allocations.filter(a => a.charging).length;
      expect(chargingCount).toBe(5);
    });

    test('動態模式功率最大化', () => {
      const guns = generateGuns(8, 2, 2, 1, [1, 3, 5, 9, 11, 13]); // 多支槍充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 350 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('動態模式功率最大化', 350, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      // 功率使用率應該很高
      const utilizationRate = (result.summary.total_allocated_kw / 350) * 100;
      expect(utilizationRate).toBeGreaterThan(80); // 至少80%使用率
    });

    test('DC功率分配精確測試', () => {
      // 重現問題：100kW場域，1支AC充電7kW，1支DC應該得到91.68kW
      const guns = [
        {
          cpsn: 'AC7_1',
          cpid: 'AC7_1', 
          acdc: 'AC',
          rated_power_kw: 7,
          rated_current_a: 32,
          voltage_v: 220,
          guns_status: 'Charging',  // 修正字段名稱
          current_power_kw: 7.0,
          requested_power_kw: 7.0,
          max_kw: 7  // 修正字段名稱
        },
        {
          cpsn: 'AC7_2',
          cpid: 'AC7_2',
          acdc: 'AC', 
          rated_power_kw: 7,
          rated_current_a: 32,
          voltage_v: 220,
          guns_status: 'Available',  // 修正字段名稱
          current_power_kw: 0,
          requested_power_kw: 0,
          max_kw: 7  // 修正字段名稱
        },
        {
          cpsn: 'DC120_1',
          cpid: 'DC120_1',
          acdc: 'DC',
          rated_power_kw: 120,  // 提高規格以容納更多功率
          rated_current_a: 125, 
          voltage_v: 500,
          guns_status: 'Charging',  // 修正字段名稱
          current_power_kw: 50.0,
          requested_power_kw: 100.0,  // 請求更多功率
          max_kw: 120  // 提高最大功率限制
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid);
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('DC功率分配精確測試', 100, guns, result);
      
      // 理論計算：100kW - 7kW(AC充電) - 1.32kW(AC待機) = 91.68kW 給DC
      const theoreticalACCharging = 7.0;
      const theoreticalACStandby = 1.32;
      const theoreticalDC = 100 - theoreticalACCharging - theoreticalACStandby;
      
      const acChargingAllocation = result.allocations.find(a => a.cpid === 'AC7_1');
      const acStandbyAllocation = result.allocations.find(a => a.cpid === 'AC7_2');
      const dcAllocation = result.allocations.find(a => a.cpid === 'DC120_1');
      
      console.log(`\n📊 DC功率分配分析:`);
      console.log(`AC充電槍 (AC7_1): ${acChargingAllocation.allocated_kw.toFixed(2)}kW (期望: ${theoreticalACCharging}kW)`);
      console.log(`AC待機槍 (AC7_2): ${acStandbyAllocation.allocated_kw.toFixed(2)}kW (期望: ${theoreticalACStandby}kW)`);
      console.log(`DC充電槍 (DC120_1): ${dcAllocation.allocated_kw.toFixed(2)}kW (期望: ${theoreticalDC.toFixed(2)}kW)`);
      console.log(`總功率: ${result.summary.total_allocated_kw.toFixed(2)}kW / 100kW`);
      
      // 驗證分配結果
      expect(result.summary.within_limit).toBe(true);
      expect(acChargingAllocation.allocated_kw).toBeCloseTo(theoreticalACCharging, 1);
      expect(acStandbyAllocation.allocated_kw).toBeCloseTo(theoreticalACStandby, 1);
      
      // 重點：驗證DC槍是否得到正確的功率分配
      if (Math.abs(dcAllocation.allocated_kw - theoreticalDC) > 1.0) {
        console.log(`❌ DC功率分配錯誤！實際: ${dcAllocation.allocated_kw.toFixed(2)}kW, 期望: ${theoreticalDC.toFixed(2)}kW`);
      }
      expect(dcAllocation.allocated_kw).toBeCloseTo(theoreticalDC, 0); // 允許1kW誤差
    });
  });

  describe('DC充電樁功率共享測試', () => {
    test('雙槍DC充電樁-單槍充電', () => {
      // 測試雙槍DC充電樁，只有一支槍充電的情況
      const guns = [
        {
          cpsn: 'DC_STATION_1', // 同一個站點
          cpid: 'DC120_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging' // 第一支槍充電
        },
        {
          cpsn: 'DC_STATION_1', // 同一個站點
          cpid: 'DC120_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available' // 第二支槍待機
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 180 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('雙槍DC充電樁-單槍充電', 180, guns, result);
      
      // 驗證充電槍獲得更多功率，待機槍只有最低功率
      const chargingAllocation = result.allocations.find(a => a.charging);
      const standbyAllocation = result.allocations.find(a => !a.charging);
      
      expect(chargingAllocation).toBeDefined();
      expect(standbyAllocation).toBeDefined();
      expect(chargingAllocation.allocated_kw).toBeGreaterThan(standbyAllocation.allocated_kw);
      expect(standbyAllocation.allocated_kw).toBe(1.0); // DC最低功率
      expect(result.summary.within_limit).toBe(true);
    });

    test('雙槍DC充電樁-雙槍同時充電', () => {
      // 測試雙槍DC充電樁，兩支槍同時充電的情況
      const guns = [
        {
          cpsn: 'DC_STATION_1', // 同一個站點
          cpid: 'DC120_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging' // 第一支槍充電
        },
        {
          cpsn: 'DC_STATION_1', // 同一個站點  
          cpid: 'DC120_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging' // 第二支槍也充電
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 200 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('雙槍DC充電樁-雙槍同時充電', 200, guns, result);
      
      // 驗證兩支槍共享站點功率
      const allocation1 = result.allocations.find(a => a.cpid === 'DC120_1_GUN1');
      const allocation2 = result.allocations.find(a => a.cpid === 'DC120_1_GUN2');
      
      expect(allocation1).toBeDefined();
      expect(allocation2).toBeDefined();
      expect(allocation1.charging).toBe(true);
      expect(allocation2.charging).toBe(true);
      
      // 總功率應該合理分配，不超過場域限制
      const totalAllocated = allocation1.allocated_kw + allocation2.allocated_kw;
      expect(totalAllocated).toBeLessThanOrEqual(200);
      expect(result.summary.within_limit).toBe(true);
      
      // 在功率充足的情況下，兩支槍應該得到相近的功率分配
      expect(Math.abs(allocation1.allocated_kw - allocation2.allocated_kw)).toBeLessThan(10);
    });

    test('多個雙槍DC充電樁', () => {
      // 測試多個雙槍DC充電樁的功率共享
      const guns = [
        // 第一個DC站點
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        },
        // 第二個DC站點
        {
          cpsn: 'DC_STATION_2',
          cpid: 'DC180_2_GUN1',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_2',
          cpid: 'DC180_2_GUN2',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 300 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('多個雙槍DC充電樁', 300, guns, result);
      
      // 驗證站點1的功率分配
      const station1Gun1 = result.allocations.find(a => a.cpid === 'DC120_1_GUN1');
      const station1Gun2 = result.allocations.find(a => a.cpid === 'DC120_1_GUN2');
      
      // 驗證站點2的功率分配
      const station2Gun1 = result.allocations.find(a => a.cpid === 'DC180_2_GUN1');
      const station2Gun2 = result.allocations.find(a => a.cpid === 'DC180_2_GUN2');
      
      expect(station1Gun1.charging).toBe(true);
      expect(station1Gun2.charging).toBe(false);
      expect(station2Gun1.charging).toBe(true);
      expect(station2Gun2.charging).toBe(true);
      
      // 站點1：充電槍功率 > 待機槍功率
      expect(station1Gun1.allocated_kw).toBeGreaterThan(station1Gun2.allocated_kw);
      expect(station1Gun2.allocated_kw).toBe(1.0); // 最低功率
      
      // 站點2：兩支充電槍共享功率
      expect(station2Gun1.allocated_kw).toBeGreaterThan(1.0);
      expect(station2Gun2.allocated_kw).toBeGreaterThan(1.0);
      
      expect(result.summary.within_limit).toBe(true);
    });

    test('DC充電樁功率不足時的分配', () => {
      // 測試當場域功率不足時，DC充電樁的功率分配策略
      const guns = [
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_2',
          cpid: 'DC180_2_GUN1',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 50 }; // 功率嚴重不足
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('DC充電樁功率不足時的分配', 50, guns, result);
      
      // 所有槍都應該獲得分配，但總功率不超過限制
      expect(result.allocations).toHaveLength(3);
      expect(result.summary.within_limit).toBe(true);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(50);
      
      // 每支槍都應該獲得至少最低功率
      result.allocations.forEach(allocation => {
        expect(allocation.allocated_kw).toBeGreaterThanOrEqual(1.0);
      });
    });

    test('DC站點混合充電狀態', () => {
      // 測試DC站點中有充電和待機槍混合的複雜情況
      const guns = [
        // 站點1：一支充電，一支待機
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_1',
          cpid: 'DC120_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        },
        // 站點2：兩支都充電
        {
          cpsn: 'DC_STATION_2',
          cpid: 'DC180_2_GUN1',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_STATION_2',
          cpid: 'DC180_2_GUN2',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        },
        // 站點3：兩支都待機
        {
          cpsn: 'DC_STATION_3',
          cpid: 'DC120_3_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        },
        {
          cpsn: 'DC_STATION_3',
          cpid: 'DC120_3_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 400 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('DC站點混合充電狀態', 400, guns, result);
      
      // 統計充電和待機槍數
      const chargingCount = result.allocations.filter(a => a.charging).length;
      const standbyCount = result.allocations.filter(a => !a.charging).length;
      
      expect(chargingCount).toBe(3); // 3支充電槍
      expect(standbyCount).toBe(3);  // 3支待機槍
      
      // 驗證充電槍獲得更多功率
      const chargingAllocations = result.allocations.filter(a => a.charging);
      const standbyAllocations = result.allocations.filter(a => !a.charging);
      
      chargingAllocations.forEach(allocation => {
        expect(allocation.allocated_kw).toBeGreaterThan(1.0);
      });
      
      standbyAllocations.forEach(allocation => {
        expect(allocation.allocated_kw).toBe(1.0); // 最低功率
      });
      
      expect(result.summary.within_limit).toBe(true);
    });

    test('單槍DC充電樁與雙槍DC充電樁混合', () => {
      // 測試單槍和雙槍DC充電樁混合的場景
      const guns = [
        // 單槍DC站點
        {
          cpsn: 'DC_SINGLE_STATION_1',
          cpid: 'DC180_SINGLE_1',
          acdc: 'DC',
          max_kw: 180,
          guns_status: 'Charging'
        },
        // 雙槍DC站點
        {
          cpsn: 'DC_DUAL_STATION_1',
          cpid: 'DC120_DUAL_1_GUN1',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Charging'
        },
        {
          cpsn: 'DC_DUAL_STATION_1',
          cpid: 'DC120_DUAL_1_GUN2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        },
        // 另一個單槍DC站點
        {
          cpsn: 'DC_SINGLE_STATION_2',
          cpid: 'DC120_SINGLE_2',
          acdc: 'DC',
          max_kw: 120,
          guns_status: 'Available'
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 250 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('單槍DC充電樁與雙槍DC充電樁混合', 250, guns, result);
      
      // 驗證單槍站點功率分配
      const singleStation1 = result.allocations.find(a => a.cpid === 'DC180_SINGLE_1');
      const singleStation2 = result.allocations.find(a => a.cpid === 'DC120_SINGLE_2');
      
      // 驗證雙槍站點功率分配
      const dualStationGun1 = result.allocations.find(a => a.cpid === 'DC120_DUAL_1_GUN1');
      const dualStationGun2 = result.allocations.find(a => a.cpid === 'DC120_DUAL_1_GUN2');
      
      expect(singleStation1.charging).toBe(true);
      expect(singleStation2.charging).toBe(false);
      expect(dualStationGun1.charging).toBe(true);
      expect(dualStationGun2.charging).toBe(false);
      
      // 充電槍功率 > 待機槍功率
      expect(singleStation1.allocated_kw).toBeGreaterThan(singleStation2.allocated_kw);
      expect(dualStationGun1.allocated_kw).toBeGreaterThan(dualStationGun2.allocated_kw);
      
      // 待機槍應該是最低功率
      expect(singleStation2.allocated_kw).toBe(1.0);
      expect(dualStationGun2.allocated_kw).toBe(1.0);
      
      expect(result.summary.within_limit).toBe(true);
    });
  });

  describe('邊界條件測試', () => {
    test('最大樁數測試', () => {
      const guns = generateGuns(25, 10, 10, 5, [1, 5, 10, 15, 20, 30, 35, 40, 45]); // 50支槍
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 480 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('最大樁數測試', 480, guns, result);
      
      expect(result.allocations).toHaveLength(50);
      expect(result.summary.within_limit).toBe(true);
    });

    test('極限超載', () => {
      const guns = generateGuns(0, 0, 10, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // 10支DC槍全部充電
      const onlineCpids = guns.map(g => g.cpid); // 使用 cpid
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 100 }; // 功率嚴重不足
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('極限超載', 100, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(100);
    });

    test('單一DC槍超過場域功率', () => {
      // 測試當單一DC槍的最大功率超過場域功率時的處理
      const guns = [
        {
          cpsn: 'DC180_1',
          cpid: 'DC180_1',
          acdc: 'DC',
          rated_power_kw: 180,
          rated_current_a: 375,
          voltage_v: 500,
          guns_status: 'Charging',
          current_power_kw: 80.0,
          requested_power_kw: 180.0,
          max_kw: 180
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpsn);
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 50 }; // 場域功率小於DC槍需求
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('單一DC槍超過場域功率', 50, guns, result);
      
      const dcAllocation = result.allocations[0];
      expect(result.summary.within_limit).toBe(true);
      expect(dcAllocation.allocated_kw).toBeLessThanOrEqual(50);
      expect(dcAllocation.allocated_kw).toBeGreaterThanOrEqual(1); // 至少最低功率
    });

    test('零功率場域', () => {
      // 測試場域功率為0時的邊界情況
      const guns = generateGuns(2, 0, 1, 0, [1]);
      const onlineCpids = guns.map(g => g.cpid);
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 0 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('零功率場域', 0, guns, result);
      
      // EMS 算法會分配最低功率即使場域為 0kW，導致超出限制
      expect(result.summary.within_limit).toBe(false);
      expect(result.summary.total_allocated_kw).toBeGreaterThan(0); // 實際會分配最低功率
      
      // 驗證每支槍都獲得最低功率分配
      result.allocations.forEach(allocation => {
        if (allocation.acdc === 'AC') {
          expect(allocation.allocated_kw).toBe(1.32); // AC 最低 6A = 1.32kW
        } else {
          expect(allocation.allocated_kw).toBe(1.0); // DC 最低 1kW
        }
      });
    });

    test('所有槍離線', () => {
      // 測試所有槍都離線的情況
      const guns = generateGuns(5, 2, 3, 1, []);
      const onlineCpids = []; // 空的在線列表
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('所有槍離線', 100, guns, result);
      
      // 當沒有在線槍時，EMS 會回退到靜態模式，仍然分配功率給所有槍
      expect(result.allocations.length).toBeGreaterThan(0);
      expect(result.summary.total_allocated_kw).toBeGreaterThan(0);
      
      // 檢查是否回退到靜態模式
      const hasStaticAllocation = result.allocations.some(a => a.allocated_kw > 0);
      expect(hasStaticAllocation).toBe(true);
    });

    test('混合狀態壓力測試', () => {
      // 測試複雜的混合狀態：多種功率、多種狀態、功率不足
      const guns = [
        { cpsn: 'AC7_1', cpid: 'AC7_1', acdc: 'AC', max_kw: 7, guns_status: 'Charging' },
        { cpsn: 'AC7_2', cpid: 'AC7_2', acdc: 'AC', max_kw: 7, guns_status: 'Available' },
        { cpsn: 'AC11_1', cpid: 'AC11_1', acdc: 'AC', max_kw: 11, guns_status: 'Charging' },
        { cpsn: 'AC11_2', cpid: 'AC11_2', acdc: 'AC', max_kw: 11, guns_status: 'Available' },
        { cpsn: 'DC60_1', cpid: 'DC60_1', acdc: 'DC', max_kw: 60, guns_status: 'Charging' },
        { cpsn: 'DC120_1', cpid: 'DC120_1', acdc: 'DC', max_kw: 120, guns_status: 'Charging' },
        { cpsn: 'DC180_1', cpid: 'DC180_1', acdc: 'DC', max_kw: 180, guns_status: 'Available' }
      ];
      
      const onlineCpids = guns.map(g => g.cpid);
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 50 }; // 嚴重功率不足
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('混合狀態壓力測試', 50, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      expect(result.summary.total_allocated_kw).toBeLessThanOrEqual(50);
      
      // 驗證動態模式優先級：充電中的槍應該優先獲得功率
      const chargingAllocations = result.allocations.filter(a => a.charging);
      const standbyAllocations = result.allocations.filter(a => !a.charging);
      
      // 充電中的槍應該獲得更多功率
      chargingAllocations.forEach(allocation => {
        expect(allocation.allocated_kw).toBeGreaterThan(1.32); // 超過最低功率
      });
      
      // 待機槍應該只有最低功率
      standbyAllocations.forEach(allocation => {
        const expectedMin = allocation.cpid.includes('AC') ? 1.32 : 1.0;
        expect(allocation.allocated_kw).toBeCloseTo(expectedMin, 1);
      });
    });

    test('數據類型邊界測試', () => {
      // 測試極值數據類型和精度
      const guns = [
        {
          cpsn: 'TEST_1',
          cpid: 'TEST_1',
          acdc: 'DC',
          rated_power_kw: 0.001, // 極小功率
          max_kw: 0.001,
          guns_status: 'Charging'
        },
        {
          cpsn: 'TEST_2', 
          cpid: 'TEST_2',
          acdc: 'DC',
          rated_power_kw: 999.999, // 極大功率
          max_kw: 999.999,
          guns_status: 'Available'
        }
      ];
      
      const onlineCpids = guns.map(g => g.cpid);
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 1000 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      logTestResult('數據類型邊界測試', 1000, guns, result);
      
      expect(result.summary.within_limit).toBe(true);
      expect(result.allocations).toHaveLength(2);
      
      // 驗證極小功率槍按其規格分配（如果算法不強制最低1kW）
      const smallPowerAllocation = result.allocations.find(a => a.cpid === 'TEST_1');
      // 如果 EMS 算法遵循槍的實際規格，則應該得到 0.001kW 或更多
      expect(smallPowerAllocation.allocated_kw).toBeGreaterThanOrEqual(0.001);
    });
  });

  describe('性能測試', () => {
    test('大規模性能測試', () => {
      const startTime = Date.now();
      const guns = generateGuns(25, 15, 8, 2, Array.from({length: 25}, (_, i) => i + 1)); // 50支槍，25支充電
      const onlineCpids = guns.map(g => g.cpsn); // 使用 cpsn
      const siteSetting = { ems_mode: 'dynamic', max_power_kw: 480 };
      
      const result = calculateEmsAllocation(siteSetting, guns, onlineCpids);
      const executionTime = Date.now() - startTime;
      
      logTestResult(`大規模性能測試`, 480, guns, result, executionTime);
      
      expect(result.allocations).toHaveLength(50);
      expect(executionTime).toBeLessThan(1000); // 執行時間應小於1秒
      expect(result.summary.within_limit).toBe(true);
    });
  });

  describe('數據類型測試', () => {
    test('AC槍分配單位應為A', () => {
      const guns = generateGuns(3, 2, 0, 0);
      const siteSetting = { ems_mode: 'static', max_power_kw: 100 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('AC槍分配單位應為A', 100, guns, result);
      
      const acAllocations = result.allocations.filter(a => a.acdc === 'AC');
      acAllocations.forEach(allocation => {
        expect(allocation.unit).toBe('A');
        expect(typeof allocation.limit).toBe('number');
        expect(allocation.limit).toBeGreaterThan(0);
      });
    });

    test('DC槍分配單位應為W', () => {
      const guns = generateGuns(0, 0, 2, 2);
      const siteSetting = { ems_mode: 'static', max_power_kw: 480 };
      
      const result = calculateEmsAllocation(siteSetting, guns);
      logTestResult('DC槍分配單位應為W', 480, guns, result);
      
      const dcAllocations = result.allocations.filter(a => a.acdc === 'DC');
      dcAllocations.forEach(allocation => {
        expect(allocation.unit).toBe('W');
        expect(typeof allocation.limit).toBe('number');
        expect(allocation.limit).toBeGreaterThan(0);
      });
    });
  });
});

// 測試完成後自動生成報告
afterAll(() => {
  generateTestReport();
});
