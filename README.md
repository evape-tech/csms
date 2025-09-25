# CSMS Next.js 專案

這是一個基於 [Next.js](https://nextjs.org) 的充電站管理系統 (CSMS) 專案，採用現代化微服務架構，結合了前端使用者介面、後端 API 服務以及 OCPP (Open Charge Point Protocol) 伺服器，並內建了智能能源管理系統 (EMS)。

## 📚 文檔目錄

- **[API 結構文檔](docs/API_STRUCTURE.md)** - 完整的 API 端點說明、版本管理和使用範例
- **[EMS 模式說明](docs/EMS_MODE.md)** - 能源管理系統的運作模式和配置
- **[自動計費系統](docs/AUTO_BILLING.md)** - 計費系統的運作原理和配置
- **[服務重構說明](docs/SERVICE_REFACTORING.md)** - 系統架構和服務設計說明

## 🚀 專案特色

-   **Next.js 15 前端**: 提供響應式且高效能的使用者介面，採用 App Router 架構進行充電站監控和管理。
-   **OCPP 1.6 協議**: 完整實現 OCPP 協議，支援 WebSocket 雙向通訊和多種消息類型處理。
-   **智能能源管理系統 (EMS)**: 
    - 🔄 **三種觸發機制**: 手動觸發、定時校正、事件驅動
    - ⚡ **智能功率分配**: 支援靜態和動態分配模式，電表級精細化管理
    - 🎯 **即時響應**: 毫秒級的充電狀態變化響應
    - 📊 **多層架構**: 場域 → 電表 → 充電樁的階層式功率管理
-   **自動計費系統**: 
    - 💰 **智能計費**: 交易完成時自動生成billing記錄，支援多種費率方案
    - 🔄 **孤兒交易處理**: 自動處理異常中斷的交易並生成對應計費
    - 🛡️ **防重複機制**: 確保每筆交易只計費一次
    - 📊 **多費率支援**: 固定費率、分時費率、累進費率等多種計費模式
-   **多資料庫支援**: 支援 MSSQL 和 MySQL，使用 Prisma ORM 進行統一管理和自動生成客戶端。
-   **完整的用戶管理**: 管理員與一般用戶分離、RFID 卡片管理、錢包系統、操作日誌追蹤。
-   **RESTful API**: 完整的 API 服務，涵蓋充電樁管理、使用者認證、支付處理、故障報告、計費管理等模組。
-   **實時監控**: WebSocket 連接監控、系統狀態追蹤和效能分析。
-   **事件驅動架構 (進行中)**: RabbitMQ 消息隊列基礎架構已建立，正在逐步整合至各業務模組。

## 🛠️ 快速開始

### 環境要求

-   **Node.js** (v18+ 推薦)
-   **npm** 或 **Yarn** 包管理器
-   **資料庫**: MySQL 8.0+ 或 MSSQL Server 2019+
-   **RabbitMQ** (可選，用於事件驅動架構，目前為初步接入階段)
-   **Git** 版本控制

## ⚡ EMS 能源管理系統

### 三種功率更新機制

1. **手動觸發 (Manual)**
   - 透過 API 端點觸發功率重分配
   - 完整的 API 使用方式請參考：[API 結構文檔](docs/API_STRUCTURE.md)

2. **定時校正 (Scheduled)**
   - 每 60 秒自動執行功率校正
   - 容錯補償機制，確保系統穩定性
   - 可透過環境變數調整間隔

3. **事件驅動 (Event-driven)**
   - 即時響應 OCPP 事件 (StatusNotification, StartTransaction, StopTransaction)
   - 毫秒級響應充電狀態變化
   - 基於消息隊列的非阻塞處理

### EMS 架構特點

- **🔄 事件驅動**: 使用 EventEmitter 解決循環依賴
- **📊 智能分配**: 基於場域總功率和充電樁狀態的動態分配
- **🚀 高性能**: 支援延迟排程和批量處理
- **🛡️ 容錯機制**: 定時校正確保系統一致性

### 1. 安裝依賴

首先，複製專案並安裝所有依賴：

```bash
git clone <你的專案 Git URL>
cd csms-nextjs
npm install
# 或者使用 yarn
# yarn install
```

### 2. 環境變數設定

建立一個 `.env` 檔案在專案根目錄，並配置必要的環境變數。請參考 `.env.example` 或以下範例：

```env
# Next.js 環境變數
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# 資料庫設定 (根據你的資料庫類型選擇)
DATABASE_URL="mysql://user:password@localhost:3306/csms_db"
# 或 MSSQL
DATABASE_URL_MSSQL="sqlserver://localhost:1433;database=csms_db;user=user;password=password;encrypt=true;trustServerCertificate=true"
DB_PROVIDER="mysql" # 或 "mssql"

# OCPP 伺服器設定
OCPP_SERVER_PORT=8089
OCPP_NOTIFY_URL=http://localhost:8089/api/v1
OCPP_API_KEY=cp_api_key16888

# EMS 系統設定
EMS_RECONCILE_INTERVAL=60000  # 定時校正間隔(毫秒)
EMS_MODE=dynamic              # 分配模式: static/dynamic

# RabbitMQ 消息隊列設定 (可選 - 目前為初步集成階段)
MQ_ENABLED=false              # 是否啟用MQ，建議開發階段設為false
MQ_HOST=127.0.0.1
MQ_PORT=5672
MQ_USERNAME=guest
MQ_PASSWORD=guest
MQ_VHOST=/

# Firebase 設定 (如果使用)
FIREBASE_API_KEY="..."
FIREBASE_AUTH_DOMAIN="..."
# ... 其他 Firebase 變數
```

### 3. 資料庫設定與遷移

專案支援 MySQL 和 MSSQL 雙資料庫架構，根據你的 `DB_PROVIDER` 設定進行相應的資料庫操作：

```bash
# 生成 Prisma 客戶端 (兩個資料庫都會生成)
npm run db:generate

# MySQL 資料庫遷移
npm run db:migrate:mysql

# MSSQL 資料庫遷移  
npm run db:migrate:mssql

# 或使用 push 模式進行開發
npm run db:push:mysql    # MySQL
npm run db:push:mssql    # MSSQL

# 初始化資料庫和基礎資料
npm run db:init
```

### 4. 運行專案

專案採用微服務架構，包含 Next.js 前端/API 和 OCPP 伺服器兩個主要服務。

#### 🌐 啟動 Next.js 開發伺服器 (前端 + API)

```bash
npm run dev
# 或使用 Turbo 模式 (更快)
npm run dev:fast
```

這將在 [http://localhost:3000](http://localhost:3000) 啟動前端應用和 Next.js API 路由。

#### ⚡ 啟動 OCPP 伺服器 (後端微服務)

```bash
# 生產模式
npm run start:ocpp

# 開發模式 (支援熱重載)
npm run dev:ocpp

# 同時啟動前端和 OCPP 伺服器
npm run dev:all
```

OCPP 伺服器將在 [http://localhost:8089](http://localhost:8089) 提供以下服務：
- WebSocket 服務: `ws://localhost:8089/ocpp`
- REST API: `http://localhost:8089/api/v1`
- 健康檢查: `http://localhost:8089/health`
- 系統狀態: `http://localhost:8089/system/status`

#### 🐇 RabbitMQ 服務 (可選)

**注意**: RabbitMQ 目前為初步接入階段，主要業務邏輯尚未完全遷移至事件驅動模式。開發階段建議設定 `MQ_ENABLED=false`。

如需啟用 RabbitMQ 進行測試：
```bash
# 使用 Docker 啟動 RabbitMQ (推薦)
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# 或使用本地安裝
rabbitmq-server

# 管理介面 (如果啟用): http://localhost:15672 (guest/guest)
```

當前 MQ 架構狀態：
- ✅ **基礎架構**: 完成 RabbitMQ 連接、交換機、隊列設定
- ✅ **事件發布者**: 實現 OCPP 和 EMS 事件發布機制  
- ✅ **事件消費者**: 建立消費者框架和消息處理邏輯
- 🚧 **業務整合**: 正在逐步將核心業務邏輯遷移至事件驅動模式

## 📡 API 說明

### API 端點總覽

本專案提供完整的 RESTful API 服務，包含：

#### 🌐 Next.js API (http://localhost:3000)
- **認證與用戶管理**: 登入、會話、用戶CRUD、RFID卡片管理
- **錢包與支付**: 儲值、扣款、交易記錄、計費管理  
- **充電站管理**: 站點設定、設備監控、功率分析
- **系統管理**: 操作日誌、故障報告、報表生成

#### ⚡ OCPP Server API (http://localhost:8089)
- **系統監控**: 健康檢查、系統狀態、MQ連接狀態
- **充電樁管理**: 遠程控制、狀態查詢、重啟操作
- **能源管理**: EMS功率分配、電表管理、站點調度

完整的 API 結構、端點說明、請求格式、響應結構和使用範例請查看：**[API 結構文檔](docs/API_STRUCTURE.md)**

## 🧪 測試

專案包含針對 EMS 分配演算法的全面測試套件，支援單元測試、一致性測試和整合測試。

### 運行 EMS 相關測試

```bash
# 運行所有 EMS 測試 (推薦)
scripts/run-ems-full-tests.bat

# 或運行單元測試
scripts/run-ems-unit-tests.bat

# 使用 Jest 直接運行
npm test tests/emsAllocator.test.js
npm test tests/emsConsistency.test.js  
npm test tests/emsIntegration.test.js
```

### 測試類型

1. **單元測試** (`tests/emsAllocator.test.js`)
   - 驗證 EMS 分配演算法的純函式邏輯
   - 測試功率約束、場域限制、充電樁規格等

2. **一致性測試** (`tests/emsConsistency.test.js`)
   - 驗證新舊系統邏輯一致性
   - 確保架構遷移後功能正確性

3. **整合測試** (`tests/emsIntegration.test.js`)
   - 驗證整個 EMS 系統端到端功能
   - 測試事件驅動、API 觸發、定時校正等機制

### 測試報告

測試執行後會生成詳細報告於 `test-results/` 目錄：
- 測試覆蓋率統計
- 功率分配驗證結果  
- 效能分析數據
- 錯誤案例分析

## 📚 文件

-   **EMS 模式說明**: `docs/EMS_MODE.md` - 詳細說明靜態/動態模式差異
-   **EMS 測試報告**: `test-results/` - 最新的測試執行結果和效能分析
-   **覆蓋率報告**: `coverage/` - 代碼覆蓋率分析報告

## 🏗️ 系統架構

### 系統架構

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js 15    │    │   OCPP Server   │    │   RabbitMQ      │
│   Frontend +    │◄──►│   WebSocket +   │◄──►│   Message       │
│   API Routes    │    │   REST API      │    │   Queue (準備中) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────▼────┐              ┌───▼───┐               ┌───▼───┐
    │Database │              │  EMS  │               │Events │
    │Services │              │Engine │               │System │
    └─────────┘              └───────┘               └───────┘
```

### 當前架構特點

- **前後端分離**: Next.js 15 提供前端 UI + API Routes，OCPP Server 處理協議邏輯
- **資料庫抽象**: 使用 Prisma ORM 支援多種資料庫，統一資料存取介面
- **WebSocket 通訊**: 實現充電樁與伺服器的即時雙向通訊
- **EMS 智能管理**: 三種觸發機制確保功率分配的即時性和準確性
- **事件驅動 (進行中)**: RabbitMQ 基礎設施已就緒，正在逐步整合業務邏輯

### EMS 系統組件

1. **Controllers** - 業務邏輯控制器
   - `emsController.js` - EMS 主控制器，處理功率分配邏輯
   - `ocppController.js` - OCPP 協議處理和消息路由

2. **Services** - 核心服務層
   - `emsService.js` - EMS 能源管理服務，實現分配演算法
   - `ocppMessageService.js` - OCPP 消息處理，支援所有協議消息類型
   - `connectionService.js` - WebSocket 連接管理和狀態維護
   - `chargeEventService.js` - 充電事件處理和狀態更新

3. **Event System** - 事件驅動系統 (初步整合階段)
   - `ocppEventConsumer.js` - OCPP 事件消費者框架
   - `emsEventConsumer.js` - EMS 事件消費者框架  
   - `ocppEventPublisher.js` - 事件發布機制
   - `mqService.js` - 消息隊列基礎服務

4. **Data Layer** - 資料存取層
   - `chargePointRepository.js` - 充電樁資料存取和業務邏輯
   - `databaseService.js` - 統一資料庫服務介面
   - Prisma ORM - 多資料庫支援和類型安全

## ⚠️ 故障排除

### 常見問題

1. **資料庫連接錯誤**
   - 檢查 `.env` 文件中的資料庫 URL 是否正確
   - 確保資料庫服務正在運行
   - 運行 `npm run db:init` 初始化資料庫

2. **OCPP 伺服器無法啟動**
   - 檢查端口 8089 是否被佔用：`netstat -an | findstr 8089`
   - 確保所有依賴已安裝：`npm install`
   - 檢查 RabbitMQ 是否正在運行

3. **RabbitMQ 連接失敗**
   - **注意**: 目前 MQ 為可選功能，建議開發階段設定 `MQ_ENABLED=false`
   - 如需測試 MQ 功能：
     - 確認 RabbitMQ 服務狀態：`rabbitmq-diagnostics status`
     - 檢查防火牆設定，確保端口 5672 和 15672 開放
     - 驗證連接參數：主機、端口、用戶名、密碼
     - 檢查 Docker 容器狀態：`docker ps | grep rabbitmq`

4. **EMS 系統無響應**
   - 檢查 EMS 定時校正是否啟動：查看日誌中的定時器消息
   - 驗證事件驅動機制：查看 StatusNotification、StartTransaction 等事件處理
   - 檢查資料庫連接：`npm run db:init` 測試資料庫連接
   - 查看系統狀態：`GET /system/status`

5. **MQ 相關問題 (如果啟用)**
   - 檢查消息隊列連接狀態：`GET /mq/health`
   - 查看 MQ 管理介面：http://localhost:15672 (guest/guest)
   - 檢查事件發布者狀態：查看日誌中的發布消息

5. **前端無法載入**
   - 確認 Next.js 開發伺服器正在運行：`npm run dev`
   - 檢查瀏覽器控制台是否有錯誤訊息
   - 驗證 API 端點是否可訪問：`curl http://localhost:3000/api`
   - 確認環境變數 `NEXT_PUBLIC_API_URL` 設定正確

6. **資料庫相關問題**
   - 測試資料庫連接：`node scripts/test-db-connection.js`
   - 檢查 Prisma 客戶端：`node scripts/test-prisma.js`
   - 重新生成客戶端：`npm run db:generate`
   - 查看資料庫日誌和連接池狀態

7. **測試失敗**
   - 確保所有依賴已安裝：`npm install`
   - 檢查資料庫連接和測試資料
   - 運行特定測試：`npm test tests/emsAllocator.test.js`
   - 清理測試環境後重新運行

### 除錯技巧

```bash
# 檢查服務狀態
curl http://localhost:8089/health
curl http://localhost:8089/system/status

# API 使用範例請參考
# 📖 完整的 API 使用範例和文檔：docs/API_STRUCTURE.md

# 快速測試 - 健康檢查
curl http://localhost:8089/health

# 檢查 RabbitMQ 管理界面 (如果啟用)
# http://localhost:15672 (guest/guest)
```

如果遇到其他問題，請檢查 `docs/` 目錄下的文件或提交 Issue。

## 🚀 部署

### 生產環境部署

1. **Next.js 前端部署**
   ```bash
   # 建構生產版本
   npm run build
   
   # 啟動生產伺服器
   npm run start
   ```
   
   推薦部署平台：[Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)

2. **OCPP 後端服務部署**
   ```bash
   # 同時啟動前端和後端
   npm run start:prod
   
   # 或分別部署
   npm run start         # Next.js
   npm run start:ocpp    # OCPP Server
   ```

3. **Docker 部署** (推薦)
   ```dockerfile
   # 建立 Dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3000 8089
   CMD ["npm", "run", "start:prod"]
   ```

4. **環境變數設定**
   - 生產環境請確保設定正確的資料庫連接
   - 配置 RabbitMQ 集群以提高可用性
   - 設定適當的日誌級別和監控

查看 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying) 以獲取更多詳細資訊。

## 貢獻

歡迎任何形式的貢獻！如果你有任何問題或建議，請隨時提出。

### 貢獻指南

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 授權

本專案採用 MIT 授權條款。詳見 [LICENSE](LICENSE) 文件。

## 聯繫資訊

如果您有任何問題或建議，請透過以下方式聯繫：

-   電子郵件: your-email@example.com
-   GitHub Issues: [專案 Issues](https://github.com/your-username/csms-nextjs/issues)

## 📁 專案結構

```
csms-nextjs/
├── .env.example              # 環境變數範例
├── eslint.config.mjs          # ESLint 配置
├── next.config.ts            # Next.js 配置
├── package.json              # 專案依賴和腳本
├── postcss.config.mjs        # PostCSS 配置
├── tsconfig.json             # TypeScript 配置
├── coverage/                 # 測試覆蓋率報告
├── docs/                     # 專案文件
│   └── EMS_MODE.md           # EMS 模式說明文檔
├── test-results/             # EMS 測試執行結果
│   ├── ems-test-report-*.md  # 詳細測試報告
│   └── performance-*.json    # 效能分析數據
├── prisma/                   # Prisma 資料庫模式定義
│   ├── schema.mssql.prisma   # MSSQL 模式
│   └── schema.prisma         # MySQL 模式
├── prisma-clients/           # Prisma 生成的客戶端 (自動生成)
├── public/                   # 靜態資源 (圖片, SVG)
├── scripts/                  # 輔助腳本
│   ├── create-test-user.js   # 建立測試用戶
│   ├── hash-passwords.js     # 密碼雜湊工具
│   ├── init-database.js      # 資料庫初始化
│   ├── run-ems-full-tests.bat # 運行完整 EMS 測試
│   ├── run-ems-unit-tests.bat # 運行單元測試
│   ├── test-db-connection.js # 測試資料庫連接
│   └── test-prisma.js        # 測試 Prisma 連接
├── src/
│   ├── app/                  # Next.js 15 App Router 頁面和 API 路由
│   │   ├── api/              # RESTful API 路由
│   │   │   ├── billing/      # 計費管理 API
│   │   │   ├── cards/        # RFID 卡片管理 API
│   │   │   ├── charging_status/ # 充電狀態管理 API
│   │   │   ├── dashboard/    # 儀表板資料 API
│   │   │   ├── database/     # 資料庫管理 API
│   │   │   ├── login/        # 認證相關 API
│   │   │   ├── operation-logs/ # 操作日誌 API
│   │   │   ├── session/      # 會話管理 API
│   │   │   ├── users/        # 用戶管理 API
│   │   │   ├── wallet/       # 錢包系統 API
│   │   │   └── ... (其他業務模組 API)
│   │   ├── charging_status/  # 充電狀態監控頁面
│   │   ├── dashboard/        # 系統儀表板頁面
│   │   ├── database-management/ # 資料庫管理介面
│   │   ├── fault_report/     # 故障報告頁面
│   │   ├── hardware_maintenance/ # 硬體維護頁面
│   │   ├── login/            # 用戶登入頁面
│   │   ├── operation_log/    # 操作日誌頁面
│   │   ├── power_analysis/   # 功率分析頁面
│   │   ├── pricing_management/ # 費率管理頁面
│   │   ├── reports/          # 報表中心頁面
│   │   ├── security_log/     # 安全日誌頁面
│   │   ├── user_management/  # 用戶管理頁面
│   │   └── ... (其他功能頁面)
│   ├── actions/              # Next.js Server Actions
│   │   ├── authActions.js    # 認證相關動作
│   │   ├── gunActions.js     # 充電槍操作動作
│   │   ├── paymentActions.ts # 支付相關動作
│   │   ├── stationActions.js # 場域管理動作
│   │   ├── tariffActions.ts  # 費率管理動作
│   │   └── userActions.ts    # 用戶管理動作
│   ├── components/           # React 可重用組件
│   │   ├── cards/            # 卡片組件
│   │   ├── charts/           # 圖表組件
│   │   ├── common/           # 通用組件
│   │   ├── dialog/           # 對話框組件
│   │   │   ├── CardManagementDialog.tsx # 卡片管理對話框
│   │   │   ├── ResetPasswordDialog.tsx  # 重設密碼對話框
│   │   │   ├── SiteDialog.tsx           # 場域選擇對話框
│   │   │   └── UserDialog.tsx           # 用戶編輯對話框
│   │   ├── layout/           # 佈局組件
│   │   │   └── Sidebar.tsx   # 側邊欄組件
│   │   ├── navigation/       # 導航組件
│   │   ├── ui/               # 基礎 UI 組件
│   │   └── ... (其他組件模組)
│   ├── lib/                  # 輔助函式庫和工具
│   │   ├── auth/             # 認證相關
│   │   │   ├── auth.ts       # 認證工具類
│   │   │   └── authMiddleware.ts # 認證中介軟體
│   │   ├── database/         # 資料庫服務層
│   │   │   ├── adapter.js    # 資料庫適配器
│   │   │   ├── middleware.js # 資料庫中介軟體
│   │   │   ├── service.js    # 統一資料庫服務介面
│   │   │   └── utils.js      # 資料庫工具函式
│   │   ├── services/         # 業務服務層
│   │   │   └── billingService.js # 計費服務
│   │   ├── emsAllocator.js   # EMS 核心分配演算法
│   │   ├── logger.js         # 統一日誌管理
│   │   ├── operationLogger.ts # 操作日誌記錄器
│   │   └── utils.js          # 通用工具函式
│   ├── models/               # 資料庫模型定義 (Sequelize)
│   └── servers/              # 後端微服務架構
│       ├── config/           # 服務配置管理
│       │   ├── envConfig.js  # 環境變數配置
│       │   └── mqConfig.js   # MQ 消息隊列配置
│       ├── connectors/       # 外部系統連接器  
│       │   └── ocppMqConnector.js # OCPP-MQ 橋接器
│       ├── consumers/        # MQ 消息消費者 (初步整合)
│       │   ├── ocppEventConsumer.js # OCPP 事件消費者
│       │   └── emsEventConsumer.js  # EMS 事件消費者
│       ├── controllers/      # 業務邏輯控制器
│       │   ├── ocppController.js    # OCPP 協議主控制器
│       │   └── emsController.js     # EMS 能源管理控制器
│       ├── publishers/       # MQ 消息發布者 (初步整合)
│       │   ├── ocppEventPublisher.js # OCPP 事件發布
│       │   └── emsEventPublisher.js  # EMS 事件發布
│       ├── repositories/     # 資料存取層 (Repository Pattern)
│       │   └── chargePointRepository.js # 充電樁資料存取
│       ├── services/         # 核心業務服務層
│       │   ├── emsService.js         # EMS 能源管理服務
│       │   ├── ocppMessageService.js # OCPP 消息處理服務
│       │   ├── connectionService.js  # WebSocket 連接管理
│       │   ├── mqService.js          # MQ 基礎服務 (初步整合)
│       │   ├── chargeEventService.js # 充電事件處理
│       │   └── systemStatusService.js # 系統狀態監控
│       ├── utils/            # 伺服器端工具函式
│       │   ├── logger.js     # 伺服器日誌工具
│       │   └── helpers.js    # 輔助函式集合
│       ├── mqServer.js       # RabbitMQ 伺服器初始化 (初步整合)
│       └── ocppServer.js     # OCPP WebSocket 伺服器主入口
├── tests/                    # 測試文件
│   ├── emsAllocator.test.js  # EMS 演算法單元測試
│   ├── emsConsistency.test.js # EMS 一致性測試
│   └── emsIntegration.test.js # EMS 整合測試
└── ... (其他設定檔)
```

### 架構說明

- **前後端分離**: Next.js 15 App Router 提供現代化前端 + API Routes，OCPP Server 專責協議處理
- **分層架構**: Controllers → Services → Repositories → Database 清晰分層
- **資料庫抽象**: Prisma ORM 提供類型安全的資料存取，支援多資料庫切換
- **WebSocket 管理**: 企業級 WebSocket 連接池，支援大規模充電樁同時接入
- **EMS 智能引擎**: 三觸發機制 + 事件驅動，確保功率分配的即時性和準確性
- **事件驅動 (進行中)**: RabbitMQ 基礎設施就緒，正在逐步將同步業務邏輯遷移至非同步事件模式
- **模組化設計**: 高內聚低耦合的組件設計，支援獨立開發和測試
- **完整的認證系統**: JWT 認證、權限控制、操作日誌追蹤
- **用戶管理系統**: 管理員/用戶分離、RFID 卡片綁定、錢包系統

---

## 🎯 專案里程碑

### ✅ 已完成功能
- **OCPP 1.6 協議**: 完整實現 WebSocket 通訊和所有核心消息類型
- **EMS 三種觸發機制**: 手動、定時、事件驅動全部實現並經測試驗證
- **智能功率分配**: 支援靜態/動態模式，電表級精細化管理
- **多資料庫支援**: MySQL/MSSQL 雙資料庫架構，Prisma ORM 統一管理
- **完整測試體系**: 86.7% 測試覆蓋率，涵蓋單元測試、整合測試、一致性測試
- **前端管理系統**: Next.js 15 響應式介面，涵蓋充電站監控、用戶管理、報表分析等模組
- **用戶管理系統**: 
  - 管理員與一般用戶分離管理
  - RFID 卡片綁定與管理
  - 用戶錢包系統 (儲值/扣款)
  - 用戶權限控制與帳戶狀態管理
  - 密碼重設與帳戶安全機制
- **操作日誌系統**: 完整的操作追蹤與審計功能
- **資料庫日誌優化**: cp_logs 表僅記錄 OCPP JSON 消息，優化儲存效率
- **認證與授權**: JWT 認證、權限中介軟體、會話管理
- **計費管理**: 費率設定、計費渠道管理、交易記錄

### 🚧 正在開發
- **事件驅動架構完整整合**: RabbitMQ 基礎設施已建立，正在將核心業務邏輯遷移至事件驅動模式
- **效能監控增強**: WebSocket 連接監控、系統資源追蹤、告警機制
- **OCPP 2.0.1 支援**: 新版協議研究和實現規劃
- **進階 EMS 演算法**: 基於歷史數據的機器學習功率預測和優化
- **支付系統整合**: 第三方支付接口整合
- **行動端應用**: 管理員行動應用開發

### 📋 規劃功能
- **容器化部署**: Docker 和 Kubernetes 部署方案
- **高可用性架構**: 負載均衡、故障切換、資料備份策略
- **監控和告警**: Prometheus + Grafana 監控體系
- **API 文檔**: Swagger/OpenAPI 自動生成文檔
- **國際化支援**: 多語言界面支持
- **進階報表**: 自定義報表生成器

### 📊 系統指標
- **API 回應時間**: < 100ms (平均)
- **WebSocket 連接**: 支援 1000+ 充電樁同時在線
- **EMS 響應時間**: 毫秒級事件處理
- **資料庫效能**: 支援高併發讀寫操作
- **系統可用性**: 99.5+ (測試環境)
- **測試覆蓋率**: 86.7% (EMS 核心模組)
- **用戶並發**: 支援 100+ 管理員同時操作

**技術特點**:
- 基於 Node.js 18+ 和 Next.js 15 的現代化技術棧
- TypeScript 支援，提供完整的類型安全
- Prisma ORM 實現資料庫無關的開發體驗  
- WebSocket 長連接管理，支援大規模充電樁接入
- 事件驅動架構設計，為未來擴展奠定基礎

**注意**: MQ 事件驅動架構目前為初步接入階段，主要業務邏輯仍在傳統同步模式下運行。建議開發階段使用 `MQ_ENABLED=false` 以確保系統穩定性。

---

## 🔄 RabbitMQ 整合狀態

### 目前進度
- ✅ **基礎設施**: MQ 連接、交換機、隊列配置完成
- ✅ **發布者框架**: OCPP 和 EMS 事件發布機制實現
- ✅ **消費者框架**: 事件消費者結構建立
- ✅ **配置管理**: 完整的 MQ 配置和環境變數支援
- 🚧 **業務整合**: 正在將核心邏輯從同步轉為事件驅動模式

### 開發建議
1. **目前開發**: 使用 `MQ_ENABLED=false`，依賴現有同步邏輯
2. **MQ 測試**: 設定 `MQ_ENABLED=true` 測試事件發布/消費功能  
3. **生產部署**: 待業務邏輯完全整合後再啟用 MQ 模式

### 相關檔案
- **配置**: `src/servers/config/mqConfig.js`
- **服務**: `src/servers/services/mqService.js`
- **發布者**: `src/servers/publishers/`
- **消費者**: `src/servers/consumers/`
- **連接器**: `src/servers/mqServer.js`

---

**持續更新**: 本專案積極開發中，README 將隨功能進展同步更新。

📧 **技術支援**: 如有問題請透過 GitHub Issues 或聯繫開發團隊。
