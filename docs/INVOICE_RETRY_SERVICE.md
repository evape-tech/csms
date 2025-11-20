# 發票重試監控服務 (Invoice Retry Service)

## 概述

發票重試監控服務是一個自動化的背景服務，負責監控和重新發送失敗的發票開立請求。當系統中存在狀態為「未開立」(DRAFT) 或「開立失敗」(ERROR) 的發票時，此服務會自動重試開立這些發票。

## 功能特性

- ✅ **自動掃描**：定期掃描 `user_invoices` 表中的失敗發票
- ✅ **智能重試**：根據配置的時間閾值自動重試失敗的發票
- ✅ **批次處理**：支援批次處理多張發票，避免資源耗盡
- ✅ **錯誤追蹤**：記錄詳細的錯誤訊息，便於問題排查
- ✅ **API 限流保護**：重試間添加延遲，避免觸發 TapPay API 限流
- ✅ **手動觸發**：支援手動觸發檢查和重試

## 發票狀態說明

系統中的發票狀態定義如下：

| 狀態 | 說明 | 是否重試 |
|------|------|----------|
| `DRAFT` | 草稿（未開立） | ✅ 是 |
| `ISSUED` | 已開立 | ❌ 否 |
| `SENT` | 已發送 | ❌ 否 |
| `PAID` | 已付款 | ❌ 否 |
| `OVERDUE` | 逾期 | ❌ 否 |
| `CANCELLED` | 已取消 | ❌ 否 |
| `ERROR` | 錯誤（開立失敗） | ✅ 是 |

## 監控條件

服務會掃描符合以下條件的發票：

1. **狀態為 DRAFT**：草稿狀態，尚未開立發票
2. **狀態為 ERROR**：開立失敗，需要重試
3. **創建時間**：創建時間超過配置的 `retryAfterMinutes` 閾值
4. **批次限制**：每次最多處理 `batchSize` 張發票

## 配置選項

```javascript
{
  checkIntervalMinutes: 30,    // 檢查間隔：30分鐘
  retryAfterMinutes: 10,       // 創建後多久才重試：10分鐘
  maxRetryCount: 5,            // 最大重試次數（預留功能）
  batchSize: 10                // 每次批次處理數量：10張
}
```

## 使用方式

### 自動啟動

服務會在 OCPP 服務器啟動時自動啟動，無需額外配置：

```javascript
// 在 ocppServer.js 中自動啟動
invoiceRetryService.start({
  checkIntervalMinutes: 30,
  retryAfterMinutes: 10,
  maxRetryCount: 5,
  batchSize: 10
});
```

### 手動觸發檢查

可以通過程式碼手動觸發檢查：

```javascript
const { invoiceRetryService } = require('./servers/services');

// 手動觸發檢查
const result = await invoiceRetryService.manualCheck();

console.log(result);
// 輸出：
// {
//   message: '手動檢查完成',
//   total: 5,
//   success: 3,
//   failed: 2,
//   results: [...]
// }
```

### 獲取服務狀態

```javascript
const status = invoiceRetryService.getStatus();

console.log(status);
// 輸出：
// {
//   isRunning: true,
//   config: {
//     checkIntervalMinutes: 30,
//     retryAfterMinutes: 10,
//     maxRetryCount: 5,
//     batchSize: 10
//   },
//   nextCheckIn: '30 分鐘'
// }
```

### 更新配置

```javascript
invoiceRetryService.updateConfig({
  checkIntervalMinutes: 60,  // 改為每60分鐘檢查一次
  batchSize: 20              // 改為每次處理20張
});
```

### 停止服務

```javascript
invoiceRetryService.stop();
```

### 重新啟動服務

```javascript
invoiceRetryService.start({
  checkIntervalMinutes: 15
});
```

## 發票狀態流轉圖

```
創建發票
   ↓
[DRAFT] ────────────────────┐
   │                        │
   │ 開立成功                │ 開立失敗
   ↓                        ↓
[SENT] ←────重試成功──── [ERROR]
   │                        │
   │ TapPay 自動發送         │ 等待重試
   │                        │
   │                        └────→ (服務自動重試)
   ↓
[PAID] (用戶付款後)
   │
   ↓
完成

備註：
- [CANCELLED] 可由管理員手動設置，不會被重試
- [OVERDUE] 系統自動標記逾期，不會被重試
- [ISSUED] 已開立但未發送的中間狀態（本系統直接跳到 SENT）
```

## 工作流程

```
1. 服務啟動
   ↓
2. 等待 checkIntervalMinutes 分鐘
   ↓
3. 查詢符合條件的失敗發票 (status IN ['DRAFT', 'ERROR'])
   ↓
4. 如果沒有失敗發票 → 返回步驟 2
   ↓
5. 如果有失敗發票
   ↓
6. 逐一重試發票開立（調用 TapPay API）
   ├─ 成功 → 更新狀態為 SENT
   └─ 失敗 → 更新狀態為 ERROR 並記錄錯誤訊息
   ↓
7. 記錄處理結果（成功數、失敗數）
   ↓
8. 返回步驟 2
```

## 資料庫更新

### 成功重試

當發票重試成功時，會更新以下欄位：

```javascript
{
  status: 'SENT',                      // 狀態改為已發送（TapPay 會自動發送發票到用戶 Email）
  provider_invoice_id: 'REC_XXX',     // TapPay 開立識別碼
  sent_at: new Date(),                 // 發送時間
  error_message: null,                 // 清除錯誤訊息
  updatedAt: new Date()                // 更新時間
}
```

**狀態流轉**：`DRAFT` → `SENT` 或 `ERROR` → `SENT`

### 失敗重試

當發票重試失敗時，會更新以下欄位：

```javascript
{
  status: 'ERROR',                     // 狀態改為錯誤
  error_message: '發票開立失敗原因',   // 記錄錯誤訊息
  updatedAt: new Date()                // 更新時間
}
```

**狀態流轉**：`DRAFT` → `ERROR` 或 `ERROR` → `ERROR`（重試失敗）

## 日誌輸出

服務會輸出詳細的日誌，方便監控和問題排查：

```
[發票重試監控] 啟動服務 - 檢查間隔: 30分鐘, 重試延遲: 10分鐘
[發票重試監控] 開始執行檢查...
[發票重試監控] 發現 3 張需要重試的發票
[發票重試監控] 重試發票: INV-20250101-001 (用戶: user@example.com)
[發票重試監控] ✅ 發票 INV-20250101-001 重試成功
[發票重試監控] 檢查完成 - 成功: 2, 失敗: 1, 總計: 3 (耗時: 5432ms)
```

## 錯誤處理

### 常見錯誤

1. **缺少用戶 Email**
   - 錯誤訊息：`缺少用戶 Email 資訊`
   - 處理方式：將發票狀態更新為 ERROR

2. **TapPay API 失敗**
   - 錯誤訊息：TapPay 返回的錯誤訊息
   - 處理方式：記錄錯誤訊息，等待下次重試

3. **資料庫異常**
   - 錯誤訊息：資料庫錯誤詳情
   - 處理方式：記錄日誌，繼續處理下一張發票

## 相關文件

- [TapPay 發票 API 文檔](https://docs.tappaysdk.com/invoice/zh/)
- [orphanTransactionService.js](../src/servers/services/orphanTransactionService.js) - 參考實作
- [invoiceRepository.ts](../src/servers/repositories/invoiceRepository.ts) - 發票開立邏輯

## 維護注意事項

1. **監控日誌**：定期檢查日誌，確保服務正常運作
2. **調整配置**：根據實際情況調整檢查間隔和批次大小
3. **錯誤分析**：定期分析失敗原因，改進系統穩定性
4. **API 配額**：注意 TapPay API 的請求配額限制

## 未來擴展

- [ ] 支援最大重試次數限制（需在資料庫添加 retry_count 欄位）
- [ ] 支援不同錯誤類型的重試策略
- [ ] 支援通知管理員嚴重錯誤
- [ ] 支援統計報表和監控儀表板
