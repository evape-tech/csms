# 自動計費功能 (Auto Billing Generation)

## 功能概述

當充電交易的狀態變更為 `COMPLETED` 或 `ERROR` 時，系統會自動生成對應的billing記錄，無需手動觸發。

## 工作機制

### 1. 一般交易完成 (COMPLETED)

當OCPP `StopTransaction` 處理完成後：
1. 系統更新 `charging_transactions` 表的狀態為 `COMPLETED`
2. 在 `updateTransactionRecord` 函數中檢測到狀態變更
3. 自動調用 `billingService.generateBillingForTransaction(transactionId, { autoMode: true })`
4. 生成對應的 `billing_records` 記錄

### 2. 孤兒交易處理 (ERROR)

當孤兒交易監控服務處理超時交易時：
1. 系統更新交易狀態為 `ERROR`
2. 在 `handleOrphanTransaction` 函數中
3. 自動調用 `billingService.generateBillingForTransaction(transactionId, { autoMode: true })`
4. 為孤兒交易生成billing記錄

## 核心函數

### `generateBillingForTransaction(transactionId, options)`

**位置:** `src/servers/services/billingService.js`

**參數:**
- `transactionId` (string): 交易ID
- `options` (object): 選項參數
  - `tariffId` (number): 指定費率方案ID
  - `autoMode` (boolean): 自動模式，失敗時不拋出錯誤，默認false
  - `skipValidation` (boolean): 跳過某些驗證，默認false

**功能:**
- 手動模式: 適用於API調用，失敗時拋出錯誤
- 自動模式: 適用於系統自動觸發，失敗時返回null且不影響主流程
- 檢查交易狀態是否為 `COMPLETED`、`STOPPED` 或 `ERROR`
- 驗證是否已存在billing記錄（避免重複生成）
- 檢查是否有有效的充電量（僅自動模式）
- 自動選擇適用的費率方案
- 生成並保存billing記錄

**使用範例:**
```javascript
// 手動生成 (API調用)
const billing = await billingService.generateBillingForTransaction('TX123');

// 自動生成 (系統觸發)
const billing = await billingService.generateBillingForTransaction('TX123', { autoMode: true });

// 指定費率方案
const billing = await billingService.generateBillingForTransaction('TX123', { tariffId: 1 });
```

## 修改的文件

### 1. `src/servers/services/billingService.js`
- 新增 `autoGenerateBillingIfNeeded()` 方法
- 修改 `generateBillingForTransaction()` 支持ERROR狀態交易

### 2. `src/servers/repositories/chargePointRepository.js`
- 修改 `updateTransactionRecord()` 添加自動billing觸發邏輯
- 修改 `handleOrphanTransaction()` 添加孤兒交易billing生成

## 支持的交易狀態

| 狀態 | 說明 | Billing生成 |
|------|------|-------------|
| ACTIVE | 進行中的交易 | ❌ |
| COMPLETED | 正常完成的交易 | ✅ |
| STOPPED | 手動停止的交易 | ✅ |
| ERROR | 異常結束的交易（含孤兒交易） | ✅ |
| CANCELLED | 已取消的交易 | ❌ |

## 費率方案選擇順序

1. **指定費率方案ID** (手動生成時)
2. **充電槍關聯的費率方案** (`gun_tariffs`)
3. **預設費率方案** (根據AC/DC類型)

## 數據庫變更

### `billing_records` 表

每筆完成的交易都會自動在此表中生成對應記錄：

```sql
-- 示例billing記錄
INSERT INTO billing_records (
  transaction_id,
  tariff_id,
  applied_price,
  energy_consumed,
  energy_fee,
  total_amount,
  status,
  start_time,
  end_time,
  charging_duration,
  user_id,
  id_tag,
  cpid,
  cpsn,
  connector_id
) VALUES (
  'TX1234567890123',  -- 交易ID
  1,                  -- 費率方案ID
  5.00,               -- 適用單價
  50.000,             -- 充電量(kWh)
  250.00,             -- 電費
  250.00,             -- 總金額
  'CALCULATED',       -- 狀態
  '2025-09-22 10:00:00',
  '2025-09-22 12:00:00',
  7200,               -- 充電時長(秒)
  'user-uuid-123',
  'RFID001',
  'CP001-AC-001',
  'CS001',
  1
);
```

## 日誌記錄

系統會記錄以下關鍵事件：

```
✅ 已為交易 TX1234567890123 自動生成billing記錄 #456
✅ 已為孤兒交易 TX1234567890123 自動生成billing記錄 #789
⚠️  交易 TX1234567890123 已存在billing記錄，跳過自動生成
⚠️  交易 TX1234567890123 沒有有效的充電量，不生成billing
❌ 為交易 TX1234567890123 自動生成billing失敗: 未找到合適的費率方案
```

## 測試

執行自動billing功能測試：

```bash
cd csms-nextjs
node tests/autoBilling.test.js
```

測試內容：
- 一般交易完成時的自動billing生成
- 孤兒交易的billing生成
- 重複生成檢測
- 錯誤處理機制

## 注意事項

1. **性能影響最小:** billing生成是異步處理，不影響主要的交易更新流程
2. **防重複機制:** 每個交易只會生成一次billing記錄
3. **錯誤隔離:** billing生成失敗不會影響交易狀態更新
4. **支援孤兒交易:** 即使是異常結束的交易也會正確計費
5. **費率靈活性:** 支援多種費率方案選擇策略

## 相關API

### 手動生成billing（管理員功能）
```http
POST /api/billing/records
Content-Type: application/json

{
  "transactionId": "TX1234567890123",
  "tariffId": 1  // 可選，指定費率方案
}
```

### 查詢billing記錄
```http
GET /api/billing/records?transactionId=TX1234567890123
```

### 更新billing狀態
```http
PATCH /api/billing/records/123
Content-Type: application/json

{
  "status": "PAID",
  "payment_method": "credit_card",
  "payment_reference": "PAY123456"
}
```
