# 使用者交易記錄 API - 實時費用計算

## API 端點

```
GET /api/users/me/transactions
```

## 認證

需要 Cookie 或 Bearer Token 認證

## 查詢參數

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| mode | string | 'all' | 查詢模式：`all`, `active`, `history`, `latest` |
| type | string | 'all' | 交易類型：`wallet`, `charging`, `all` |
| status | string | - | 充電狀態過濾（多個用逗號分隔） |
| limit | number | 50 | 每頁數量（最大 500） |
| offset | number | 0 | 偏移量 |

## 查詢模式說明

### 1. `mode=active` - 查詢進行中的充電

返回當前正在進行的充電交易，**自動計算實時費用**。

**請求範例：**
```bash
GET /api/users/me/transactions?mode=active
```

**響應範例：**
```json
{
  "success": true,
  "hasActiveCharging": true,
  "activeCharging": {
    "id": 123,
    "source": "charging",
    "type": "charging",
    "transaction_id": "TX1234567890",
    "status": "ACTIVE",
    "cpid": "EV01-AC-01",
    "cpsn": "EV01-GUN1",
    "connector_id": 1,
    "start_time": "2025-10-21T14:30:00.000Z",
    "energy_consumed": 12.5,
    "current_power": 6.8,
    "current_voltage": 220,
    "current_current": 30.9,
    "charging_duration": 3600,
    "realtime_cost": {
      "tariff_id": 8,
      "tariff_name": "夏季峰谷電價",
      "tariff_type": "TIME_OF_USE",
      "energy_consumed": 12.5,
      "applied_price": 4.0,
      "energy_fee": 50.00,
      "discount_amount": 0,
      "estimated_total": 50.00,
      "currency": "TWD",
      "billing_details": {
        "rateType": "PEAK_HOURS",
        "timeFrame": "尖峰時段",
        "unitPrice": 4.0,
        "calculation": "12.5 kWh × 4 = 50.00"
      },
      "calculation_time": "2025-10-21T15:30:00.123Z"
    }
  },
  "message": "充電進行中"
}
```

**無進行中的充電：**
```json
{
  "success": true,
  "hasActiveCharging": false,
  "activeCharging": null,
  "message": "目前沒有進行中的充電"
}
```

### 2. `mode=latest` - 查詢最後一筆充電記錄

返回最近一筆充電記錄（不論狀態），**自動計算費用**。

- 如果是 `ACTIVE` 狀態：返回實時費用
- 如果是已完成狀態（`COMPLETED`, `STOPPED` 等）：返回最終費用

**請求範例：**
```bash
GET /api/users/me/transactions?mode=latest
```

**響應範例（進行中）：**
```json
{
  "success": true,
  "transaction": {
    "id": 123,
    "source": "charging",
    "status": "ACTIVE",
    "energy_consumed": 12.5,
    "charging_duration": 3600,
    "realtime_cost": {
      "tariff_name": "夏季峰谷電價",
      "estimated_total": 50.00,
      "billing_details": {
        "timeFrame": "尖峰時段",
        "calculation": "12.5 kWh × 4 = 50.00"
      }
    }
  },
  "message": "查詢成功"
}
```

**響應範例（已完成）：**
```json
{
  "success": true,
  "transaction": {
    "id": 122,
    "source": "charging",
    "status": "COMPLETED",
    "energy_consumed": 25.0,
    "start_time": "2025-10-21T10:00:00.000Z",
    "end_time": "2025-10-21T12:00:00.000Z",
    "charging_duration": 7200,
    "realtime_cost": {
      "tariff_name": "夏季峰谷電價",
      "estimated_total": 100.00,
      "billing_details": {
        "timeFrame": "尖峰時段",
        "calculation": "25 kWh × 4 = 100.00"
      }
    }
  },
  "message": "查詢成功"
}
```

**無充電記錄：**
```json
{
  "success": true,
  "transaction": null,
  "message": "尚無充電記錄"
}
```

### 3. `mode=history` - 查詢歷史充電記錄

返回已完成的充電記錄（排除 ACTIVE 狀態）。

**請求範例：**
```bash
GET /api/users/me/transactions?mode=history&limit=10
```

**響應範例：**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 122,
      "source": "charging",
      "status": "COMPLETED",
      "energy_consumed": 25.0,
      "start_time": "2025-10-21T10:00:00.000Z",
      "end_time": "2025-10-21T12:00:00.000Z"
    },
    {
      "id": 121,
      "source": "charging",
      "status": "STOPPED",
      "energy_consumed": 15.0,
      "start_time": "2025-10-20T14:00:00.000Z",
      "end_time": "2025-10-20T15:30:00.000Z"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0,
  "returned": 2
}
```

### 4. `mode=all` - 查詢所有交易記錄（預設）

返回所有交易記錄（包含錢包交易和充電記錄）。

**請求範例：**
```bash
GET /api/users/me/transactions?mode=all&limit=20
```

## realtime_cost 物件結構

當充電記錄有充電量時，會自動計算並返回 `realtime_cost` 物件：

```typescript
{
  tariff_id: number;           // 費率方案ID
  tariff_name: string;         // 費率方案名稱
  tariff_type: string;         // 費率類型 (FIXED_RATE, TIME_OF_USE, PROGRESSIVE, MEMBERSHIP, SPECIAL_PROMOTION)
  energy_consumed: number;     // 充電量 (kWh)
  applied_price: number;       // 應用單價 (元/kWh)
  energy_fee: number;          // 電力費用 (元)
  discount_amount: number;     // 折扣金額 (元)
  estimated_total: number;     // 預估總費用 (元)
  currency: string;            // 貨幣 (TWD)
  billing_details: {
    rateType: string;          // 費率類型
    calculation: string;       // 計算公式
    timeFrame?: string;        // 時段 (TIME_OF_USE 時有)
    tier1Energy?: number;      // 階梯1用電量 (PROGRESSIVE 時有)
    // ... 更多詳細資訊
  };
  calculation_time: string;    // 計算時間 (ISO 8601)
}
```

## 使用場景

### 場景 1: 外部充電 App - 顯示當前充電狀態和費用

```javascript
// 定時查詢進行中的充電
async function updateChargingStatus() {
  const response = await fetch('/api/users/me/transactions?mode=active', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success && data.hasActiveCharging) {
    const charging = data.activeCharging;
    
    // 更新 UI
    updateUI({
      energy: charging.energy_consumed,
      duration: charging.charging_duration,
      currentCost: charging.realtime_cost?.estimated_total || 0,
      tariff: charging.realtime_cost?.tariff_name || '計算中',
      calculation: charging.realtime_cost?.billing_details?.calculation || ''
    });
  } else {
    showIdleStatus();
  }
}

// 每 5 秒更新一次
setInterval(updateChargingStatus, 5000);
```

### 場景 2: 顯示最後一次充電記錄

```javascript
// 查詢最後一筆充電記錄
async function loadLastCharging() {
  const response = await fetch('/api/users/me/transactions?mode=latest', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success && data.transaction) {
    const tx = data.transaction;
    
    return {
      status: tx.status,
      energy: tx.energy_consumed,
      cost: tx.realtime_cost?.estimated_total,
      tariff: tx.realtime_cost?.tariff_name,
      startTime: tx.start_time,
      endTime: tx.end_time,
      isActive: tx.status === 'ACTIVE'
    };
  }
  
  return null;
}
```

### 場景 3: React 組件範例

```jsx
import { useState, useEffect } from 'react';

function ChargingStatus() {
  const [charging, setCharging] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/users/me/transactions?mode=active');
        const data = await response.json();
        
        if (data.success && data.hasActiveCharging) {
          setCharging(data.activeCharging);
        } else {
          setCharging(null);
        }
      } catch (error) {
        console.error('Failed to fetch charging status:', error);
      } finally {
        setLoading(false);
      }
    };

    // 初始載入
    fetchStatus();

    // 每 5 秒更新一次
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>載入中...</div>;
  if (!charging) return <div>目前沒有充電中</div>;

  return (
    <div className="charging-status">
      <h2>充電中</h2>
      <div className="info">
        <p>充電站: {charging.cpsn}</p>
        <p>充電量: {charging.energy_consumed} kWh</p>
        <p>充電時長: {Math.floor(charging.charging_duration / 60)} 分鐘</p>
        <p>當前功率: {charging.current_power} kW</p>
      </div>
      
      {charging.realtime_cost && (
        <div className="cost-info">
          <h3>實時費用</h3>
          <p className="total">NT$ {charging.realtime_cost.estimated_total}</p>
          <p className="tariff">{charging.realtime_cost.tariff_name}</p>
          <p className="rate">{charging.realtime_cost.applied_price} 元/kWh</p>
          
          {charging.realtime_cost.discount_amount > 0 && (
            <p className="discount">
              已折扣: -{charging.realtime_cost.discount_amount} 元
            </p>
          )}
          
          <details>
            <summary>計算詳情</summary>
            <pre>{charging.realtime_cost.billing_details.calculation}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default ChargingStatus;
```

## 注意事項

1. **實時費用僅為預估**
   - 基於當前電量和費率計算
   - 最終帳單可能略有差異

2. **自動費率選擇**
   - 系統自動根據充電時間和充電槍綁定選擇費率
   - 考慮季節性費率和有效期限

3. **費用計算時機**
   - `mode=active`: 只在 ACTIVE 狀態時計算
   - `mode=latest`: 在 ACTIVE 或已完成且有充電量時計算

4. **錯誤處理**
   - 如果無法計算費用，`realtime_cost` 為 `null`
   - 不影響主要交易資訊的返回

## 更新日誌

### v2.0 (2025-10-21)
- ✨ `mode=active`: 新增實時費用計算
- ✨ `mode=latest`: 新增費用計算（進行中/已完成）
- 📝 完整的 API 文檔

### v1.0
- 基礎交易記錄查詢功能
