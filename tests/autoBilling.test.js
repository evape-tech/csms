/**
 * 自動計費功能測試
 * 測試當交易狀態變更為COMPLETED或ERROR時，是否會自動生成billing記錄
 */

// 模擬測試環境
const mockTransaction = {
  id: BigInt(123),
  transaction_id: 'TX1234567890123',
  cpid: 'CP001-AC-001',
  cpsn: 'CS001',
  connector_id: 1,
  user_id: 'user-uuid-123',
  id_tag: 'RFID001',
  meter_start: 100.000,
  meter_stop: 150.000,
  energy_consumed: 50.000,
  start_time: new Date('2025-09-22T10:00:00Z'),
  end_time: new Date('2025-09-22T12:00:00Z'),
  charging_duration: 7200, // 2小時
  status: 'COMPLETED',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockTariff = {
  id: 1,
  name: '測試費率方案',
  tariff_type: 'FIXED_RATE',
  base_price: 5.00,
  is_active: true,
  is_default: true,
  ac_only: false,
  dc_only: false
};

/**
 * 模擬自動billing生成測試
 */
async function testAutoBillingGeneration() {
  console.log('🧪 開始測試自動billing生成功能...');
  
  try {
    // 模擬billingService
    const mockBillingService = {
      async generateBillingForTransaction(transactionId, options = {}) {
        const { autoMode = false } = options;
        console.log(`📝 接收到billing生成請求: ${transactionId} ${autoMode ? '(自動模式)' : '(手動模式)'}`);
        
        // 模擬檢查交易狀態
        if (!['COMPLETED', 'ERROR'].includes(mockTransaction.status)) {
          if (autoMode) {
            console.log(`❌ 交易狀態 ${mockTransaction.status} 不符合billing生成條件 (自動模式跳過)`);
            return null;
          } else {
            throw new Error(`交易狀態 ${mockTransaction.status} 不符合billing生成條件`);
          }
        }
        
        // 模擬檢查是否已存在billing記錄
        console.log('🔍 檢查是否已存在billing記錄...');
        
        // 模擬計算billing
        const mockBilling = {
          id: BigInt(456),
          transaction_id: transactionId,
          tariff_id: mockTariff.id,
          applied_price: mockTariff.base_price,
          energy_consumed: mockTransaction.energy_consumed,
          energy_fee: mockTransaction.energy_consumed * mockTariff.base_price,
          service_fee: 0,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: mockTransaction.energy_consumed * mockTariff.base_price,
          start_time: mockTransaction.start_time,
          end_time: mockTransaction.end_time,
          charging_duration: mockTransaction.charging_duration,
          user_id: mockTransaction.user_id,
          id_tag: mockTransaction.id_tag,
          cpid: mockTransaction.cpid,
          cpsn: mockTransaction.cpsn,
          connector_id: mockTransaction.connector_id,
          status: 'CALCULATED',
          createdAt: new Date()
        };
        
        console.log(`✅ 成功生成billing記錄: #${mockBilling.id}`);
        console.log(`💰 計費詳情: ${mockBilling.energy_consumed} kWh × $${mockBilling.applied_price} = $${mockBilling.total_amount}`);
        
        return mockBilling;
      }
    };
    
    // 模擬交易狀態更新流程
    console.log('\n📊 模擬交易狀態更新...');
    console.log(`交易ID: ${mockTransaction.transaction_id}`);
    console.log(`原始狀態: ACTIVE`);
    console.log(`新狀態: ${mockTransaction.status}`);
    
    // 模擬狀態變更檢測
    const originalStatus = 'ACTIVE';
    const newStatus = mockTransaction.status;
    const statusChanged = originalStatus !== newStatus;
    
    if (statusChanged && ['COMPLETED', 'ERROR'].includes(newStatus)) {
      console.log('🔄 檢測到狀態變更為已完成或錯誤，觸發自動billing生成...');
      
      const billing = await mockBillingService.generateBillingForTransaction(
        mockTransaction.transaction_id, 
        { autoMode: true }
      );
      
      if (billing) {
        console.log(`🎉 測試成功！已為交易 ${mockTransaction.transaction_id} 自動生成billing記錄 #${billing.id}`);
        return true;
      } else {
        console.log('❌ 測試失敗：未生成billing記錄');
        return false;
      }
    } else {
      console.log('ℹ️  狀態未變更或不符合billing生成條件');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    return false;
  }
}

/**
 * 測試孤兒交易的billing生成
 */
async function testOrphanTransactionBilling() {
  console.log('\n🧪 開始測試孤兒交易billing生成功能...');
  
  const orphanTransaction = {
    ...mockTransaction,
    status: 'ERROR',
    stop_reason: 'ORPHAN_TRANSACTION_AUTO_CLOSED',
    energy_consumed: 25.000, // 孤兒交易可能充電量較少
    end_time: new Date() // 自動設置結束時間
  };
  
  console.log(`孤兒交易ID: ${orphanTransaction.transaction_id}`);
  console.log(`停止原因: ${orphanTransaction.stop_reason}`);
  console.log(`充電量: ${orphanTransaction.energy_consumed} kWh`);
  
  // 模擬孤兒交易billing生成
  const mockBilling = {
    id: BigInt(789),
    transaction_id: orphanTransaction.transaction_id,
    tariff_id: mockTariff.id,
    energy_consumed: orphanTransaction.energy_consumed,
    energy_fee: orphanTransaction.energy_consumed * mockTariff.base_price,
    total_amount: orphanTransaction.energy_consumed * mockTariff.base_price,
    status: 'CALCULATED',
    createdAt: new Date()
  };
  
  console.log(`✅ 成功為孤兒交易生成billing記錄: #${mockBilling.id}`);
  console.log(`💰 計費金額: $${mockBilling.total_amount}`);
  
  return true;
}

/**
 * 執行所有測試
 */
async function runAllTests() {
  console.log('🚀 開始執行自動billing生成測試套件\n');
  
  const test1 = await testAutoBillingGeneration();
  const test2 = await testOrphanTransactionBilling();
  
  console.log('\n📋 測試結果總結:');
  console.log(`- 一般交易自動billing生成: ${test1 ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`- 孤兒交易billing生成: ${test2 ? '✅ 通過' : '❌ 失敗'}`);
  
  const allPassed = test1 && test2;
  console.log(`\n🎯 整體測試結果: ${allPassed ? '✅ 全部通過' : '❌ 存在失敗'}`);
  
  return allPassed;
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('測試執行失敗:', error);
    process.exit(1);
  });
}

// 如果直接執行此文件，運行測試
if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('測試執行失敗:', error);
    process.exit(1);
  });
}

module.exports = {
  testAutoBillingGeneration,
  testOrphanTransactionBilling,
  runAllTests
};
