# CSMS 系統 API 結構規範

本文檔描述了 CSMS (充電站管理系統) 的完整 API 架構，包含 Next.js 前端 API 和 OCPP Server 後端 API。

## API 服務架構

### 服務分離
- **Next.js API** (Port 3000): 前端業務邏輯、用戶管理、認證、錢包等
- **OCPP Server** (Port 8089): OCPP 協議處理、充電樁管理、EMS 能源管理

### API 版本管理

OCPP Server API 版本通過環境變數進行管理，配置於 `.env` 文件中：

```env
API_VERSION=v1
API_BASE_PATH=/api
OCPP_API_BASE_PATH=/ocpp/api
```

Next.js API 使用 Next.js 內建的 API 路由系統，無需額外版本配置。

## API 路徑結構

### 1. Next.js API 端點 (http://localhost:3000)

#### 🔐 認證與用戶管理
- `POST /api/login` - 使用者登入
- `GET /api/session` - 會話管理
- `GET /api/users` - 獲取用戶列表
- `POST /api/users` - 新增用戶
- `PUT /api/users` - 更新用戶資訊
- `DELETE /api/users` - 刪除用戶
- `GET /api/users/[id]/cards` - 用戶 RFID 卡片管理
- `GET /api/users/[id]/wallet` - 用戶錢包資訊
- `GET /api/users/[id]/transactions` - 用戶交易記錄

#### 💳 錢包與卡片系統
- `POST /api/wallet/topup` - 錢包儲值
- `POST /api/wallet/deduct` - 錢包扣款
- `GET /api/cards` - RFID 卡片管理
- `POST /api/cards` - 新增 RFID 卡片
- `PUT /api/cards` - 更新 RFID 卡片
- `DELETE /api/cards` - 刪除 RFID 卡片
- `GET /api/cards/all` - 所有卡片資訊

#### 💰 計費與費率
- `GET /api/billing/channels` - 計費渠道管理
- `POST /api/billing/channels` - 新增計費渠道
- `PUT /api/billing/channels` - 更新計費渠道
- `DELETE /api/billing/channels` - 刪除計費渠道
- `GET /api/pricing_management` - 費率管理
- `POST /api/pricing_management` - 新增費率
- `PUT /api/pricing_management` - 更新費率
- `DELETE /api/pricing_management` - 刪除費率

#### 🏢 充電站與設備
- `GET /api/stations` - 充電站管理
- `POST /api/stations` - 新增充電站
- `PUT /api/stations` - 更新充電站
- `DELETE /api/stations` - 刪除充電站
- `GET /api/charging_status` - 充電狀態監控
- `GET /api/dashboard` - 儀表板資料

#### 📊 系統管理
- `GET /api/operation-logs` - 操作日誌查詢
- `POST /api/operation-logs` - 記錄操作日誌
- `GET /api/database` - 資料庫管理
- `POST /api/database` - 資料庫操作
- `GET /api/fault_report` - 故障報告
- `POST /api/fault_report` - 提交故障報告
- `GET /api/hardware_maintenance` - 硬體維護
- `POST /api/hardware_maintenance` - 硬體維護操作
- `GET /api/power_analysis` - 功率分析
- `GET /api/reports` - 報告生成
- `POST /api/reports` - 生成報告

### 2. OCPP Server 系統級 API（無版本號）
這些端點不包含版本號，主要用於系統健康檢查和基礎功能：

- `GET /health` - 系統健康檢查
- `GET /mq/health` - MQ連接健康檢查
- `GET /system/status` - 系統狀態查詢

### 3. OCPP Server 標準 REST API（含版本號）
用於充電樁管理的標準化 REST API：

- `GET /api/v1/chargepoints/online` - 獲取在線充電樁列表
- `POST /api/v1/chargepoints/:cpsn/remotestart` - 遠程啟動充電
- `POST /api/v1/chargepoints/:cpsn/remotestop` - 遠程停止充電
- `POST /api/v1/chargepoints/:cpsn/reset` - 重啟充電樁

### 4. OCPP 專用 API（含版本號）
用於 OCPP 協議專用功能的 API：

- `GET /ocpp/api/v1/connections` - 獲取 OCPP 連接狀態
- `POST /ocpp/api/v1/trigger_profile_update` - 觸發全站功率重新分配
- `POST /ocpp/api/v1/trigger_meter_reallocation` - 觸發電表級功率重新分配
- `POST /ocpp/api/v1/trigger_station_reallocation` - 觸發站點級功率重新分配



## 響應格式

### API 響應格式
```json
{
  "status": "success|error",
  "data": { /* 業務數據 */ },
  "apiVersion": "v1",
  "timestamp": "2025-09-25T10:00:00.000Z"
}
```

### 錯誤響應格式
```json
{
  "status": "error",
  "message": "錯誤描述",
  "apiVersion": "v1",
  "timestamp": "2025-09-25T10:00:00.000Z"
}
```

## API 使用範例

### Next.js API 範例 (http://localhost:3000)

#### 用戶認證
```bash
# 使用者登入
curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com", "password": "password"}'

# 檢查會話狀態
curl http://localhost:3000/api/session \
     -H "Cookie: session=your_session_token"
```

#### 用戶管理
```bash
# 獲取用戶列表
curl http://localhost:3000/api/users

# 新增用戶
curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"name": "新用戶", "email": "user@example.com", "role": "user"}'

# 獲取用戶錢包資訊
curl http://localhost:3000/api/users/1/wallet

# 獲取用戶交易記錄
curl http://localhost:3000/api/users/1/transactions
```

#### 錢包操作
```bash
# 錢包儲值
curl -X POST http://localhost:3000/api/wallet/topup \
     -H "Content-Type: application/json" \
     -d '{"userId": 1, "amount": 100, "paymentMethod": "credit_card"}'

# 錢包扣款
curl -X POST http://localhost:3000/api/wallet/deduct \
     -H "Content-Type: application/json" \
     -d '{"userId": 1, "amount": 50, "reason": "charging_fee"}'
```

#### 充電站管理
```bash
# 獲取所有充電站
curl http://localhost:3000/api/stations

# 新增充電站
curl -X POST http://localhost:3000/api/stations \
     -H "Content-Type: application/json" \
     -d '{"name": "新充電站", "location": "台北市", "total_power_kw": 100}'

# 獲取充電狀態
curl http://localhost:3000/api/charging_status

# 獲取儀表板資料
curl http://localhost:3000/api/dashboard
```

### OCPP Server API 範例 (http://localhost:8089)

#### 健康檢查
```bash
# 系統健康檢查
curl http://localhost:8089/health

# MQ 健康檢查
curl http://localhost:8089/mq/health

# 系統狀態查詢
curl http://localhost:8089/system/status
```

### 充電樁管理
```bash
# 獲取在線充電樁列表
curl http://localhost:8089/api/v1/chargepoints/online

# 遠程啟動充電
curl -X POST http://localhost:8089/api/v1/chargepoints/CP001/remotestart \
     -H "Content-Type: application/json" \
     -d '{"connectorId": 1, "idTag": "USER123"}'

# 遠程停止充電
curl -X POST http://localhost:8089/api/v1/chargepoints/CP001/remotestop \
     -H "Content-Type: application/json" \
     -d '{"transactionId": 12345}'

# 重啟充電樁
curl -X POST http://localhost:8089/api/v1/chargepoints/CP001/reset \
     -H "Content-Type: application/json" \
     -d '{"type": "Soft"}'
```

### OCPP 功能
```bash
# 獲取 OCPP 連接狀態
curl http://localhost:8089/ocpp/api/v1/connections

# 觸發全站功率重新分配
curl -X POST http://localhost:8089/ocpp/api/v1/trigger_profile_update \
     -H "Content-Type: application/json" \
     -d '{"source": "manual_trigger"}'

# 觸發電表級功率重新分配
curl -X POST http://localhost:8089/ocpp/api/v1/trigger_meter_reallocation \
     -H "Content-Type: application/json" \
     -d '{"meter_id": 1, "source": "meter_update"}'

# 觸發站點級功率重新分配
curl -X POST http://localhost:8089/ocpp/api/v1/trigger_station_reallocation \
     -H "Content-Type: application/json" \
     -d '{"station_id": 1, "source": "station_update"}'
```

## 開發配置

### 在程式中使用 API 配置

```javascript
const { apiConfig } = require('./config');
const { API_PATHS, buildApiPath, buildOcppApiPath } = apiConfig;

// 使用預定義路徑
app.get(API_PATHS.HEALTH, handlerFunction);

// 動態建構路徑
app.get(buildApiPath('/custom/endpoint'), handlerFunction);
app.post(buildOcppApiPath('/custom/ocpp'), handlerFunction);
```

## 版本升級

當需要升級 API 版本時：

1. 更新 `.env` 文件中的 `API_VERSION` 變數
2. 舊版本的端點自動保持向後兼容
3. 新功能使用新版本的路徑結構

## WebSocket 連接

WebSocket 連接路徑保持不變：
- `ws://host:port/ocpp` - OCPP WebSocket 連接端點

## API 總結

### 服務端口分配
- **Next.js 應用**: http://localhost:3000 (前端界面 + API)
- **OCPP Server**: http://localhost:8089 (OCPP協議 + REST API)
- **WebSocket**: ws://localhost:8089/ocpp (OCPP WebSocket通訊)

### API 特色
1. **RESTful 設計**: 遵循 REST 設計原則
2. **版本化管理**: OCPP API 支援版本控制
3. **統一響應格式**: 標準化的 JSON 響應結構
4. **完整功能覆蓋**: 涵蓋充電站管理的所有業務需求
5. **健壯的錯誤處理**: 詳細的錯誤信息和狀態碼

### 開發建議
- 使用 API 結構文檔作為開發參考
- 遵循既定的請求/響應格式
- 充分利用版本化系統進行向後兼容
- 定期檢查 API 健康檢查端點確保服務正常

如需更多技術細節，請參考專案的 README.md 或聯繫開發團隊。
