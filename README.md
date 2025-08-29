# CSMS Next.js 專案

這是一個基於 [Next.js](https://nextjs.org) 的充電站管理系統 (CSMS) 專案，結合了前端使用者介面、後端 API 服務以及 OCPP (Open Charge Point Protocol) 伺服器，並內建了能源管理系統 (EMS) 分配演算法。

## 專案特色

-   **Next.js 前端**: 提供響應式且高效能的使用者介面，用於監控和管理充電站。
-   **OCPP 伺服器**: 實現 OCPP 協議，與充電樁進行通訊和控制。
-   **能源管理系統 (EMS)**: 智能分配場域總功率給各個充電樁，支援靜態和動態分配模式。
-   **Prisma ORM**: 用於資料庫操作，支援 MSSQL 和 MySQL。
-   **API 服務**: 提供 RESTful API 供前端調用，管理充電樁、使用者、站點設定等。
-   **Firebase 整合**: 用於某些服務或認證（如果適用）。

## 快速開始

### 環境要求

-   Node.js (v18 或更高版本)
-   npm 或 Yarn
-   資料庫 (MSSQL 或 MySQL)
-   Git

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
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
# 或 MSSQL
DATABASE_URL_MSSQL="sqlserver://localhost:1433;database=mydb;user=user;password=password;encrypt=true;trustServerCertificate=true"
DB_PROVIDER="mssql" # 或 "mysql", "postgresql"

# OCPP 伺服器設定
OCPP_SERVER_PORT=9220
OCPP_NOTIFY_URL=http://localhost:3000/api/charging_status/notify

# Firebase 設定 (如果使用)
FIREBASE_API_KEY="..."
FIREBASE_AUTH_DOMAIN="..."
# ... 其他 Firebase 變數
```

### 3. 資料庫設定與遷移

根據你的 `DB_PROVIDER` 設定，執行 Prisma 遷移來建立資料庫結構：

```bash
npx prisma migrate dev --name init
# 如果需要，可以運行 seed 腳本填充初始資料
# npx prisma db seed
```

### 4. 運行專案

專案包含兩個主要部分：Next.js 前端/API 和 OCPP 伺服器。

#### 啟動 Next.js 開發伺服器

```bash
npm run dev
```

這將在 [http://localhost:3000](http://localhost:3000) 啟動前端應用和 Next.js API 路由。

#### 啟動 OCPP 伺服器

OCPP 伺服器通常由 `ocppController.js` 啟動。你可能需要一個單獨的 Node.js 進程來運行它。

```bash
node src/servers/ocppServer.js
```
或者，如果你有配置 `package.json` 腳本，可以使用：
```bash
npm run start:ocpp
```
(請確保你的 `package.json` 中有對應的 `start:ocpp` 腳本)

## API 說明

專案提供以下主要 API 端點：

-   `/api/charging_status` - 充電狀態管理
-   `/api/dashboard` - 儀表板資料
-   `/api/fault_report` - 故障報告
-   `/api/hardware_maintenance` - 硬體維護
-   `/api/login` - 使用者登入
-   `/api/payment_management` - 付款管理
-   `/api/power_analysis` - 功率分析
-   `/api/pricing_management` - 定價管理
-   `/api/reports` - 報告生成
-   `/api/security_log` - 安全日誌
-   `/api/user_management` - 使用者管理

詳細的 API 文件請參考各個端點的實現或使用工具如 Postman 進行測試。

## 測試

專案包含針對 EMS 分配演算法的全面測試套件。

### 運行所有 EMS 相關測試

```bash
npm run test:ems-full
```
(請確保你的 `package.json` 中有對應的 `test:ems-full` 腳本，或者直接運行 `scripts/run-ems-full-tests.bat`)

### 測試類型

-   **單元測試**: `tests/emsAllocator.test.js` (驗證 EMS 純函式邏輯)
-   **一致性測試**: `tests/emsConsistency.test.js` (驗證 `emsAllocator` 與 `ocppController` 邏輯一致)
-   **整合測試**: `tests/emsIntegration.test.js` (驗證 `ocppController` 整合 `emsAllocator` 後的功能)

## 文件

-   **EMS 模式說明**: `docs/EMS_MODE.md`
-   **EMS 測試案例**: `docs/EMS_TEST_CASES.md`
-   **EMS 測試報告**: `docs/EMS_TEST_REPORT.md`

## 故障排除

### 常見問題

1. **資料庫連接錯誤**
   - 檢查 `.env` 文件中的資料庫 URL 是否正確。
   - 確保資料庫服務正在運行。
   - 運行 `npm run db:init` 初始化資料庫。

2. **OCPP 伺服器無法啟動**
   - 檢查端口 9220 是否被佔用。
   - 確保所有依賴已安裝。

3. **前端無法載入**
   - 確認 Next.js 開發伺服器正在運行。
   - 檢查瀏覽器控制台是否有錯誤訊息。

4. **測試失敗**
   - 確保所有依賴已安裝。
   - 運行 `npm install` 重新安裝依賴。

如果遇到其他問題，請檢查 `docs/` 目錄下的文件或提交 Issue。

## 部署

最簡單的 Next.js 應用部署方式是使用 [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)。

查看我們的 [Next.js 部署文件](https://nextjs.org/docs/app/building-your-application/deploying) 以獲取更多詳細資訊。

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

## 專案結構

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
│   ├── EMS_MODE.md           # EMS 模式說明
│   ├── EMS_TEST_CASES.md     # EMS 測試案例
│   └── EMS_TEST_REPORT.md    # EMS 測試報告
├── prisma/                   # Prisma 資料庫模式定義
│   ├── schema.mssql.prisma
│   └── schema.prisma
├── prisma-clients/           # Prisma 生成的客戶端 (自動生成)
├── public/                   # 靜態資源 (圖片, SVG)
├── scripts/                  # 輔助腳本 (資料庫初始化, 測試運行等)
│   ├── create-test-user.js
│   ├── hash-passwords.js
│   ├── init-database.js
│   ├── run-ems-full-tests.bat # 運行所有 EMS 測試
│   ├── run-ems-unit-tests.bat
│   ├── test-db-connection.js
│   └── test-prisma.js
├── src/
│   ├── app/                  # Next.js App Router 頁面和 API 路由
│   │   ├── api/              # API 路由
│   │   ├── charging_status/  # 充電狀態相關頁面/組件
│   │   ├── dashboard/        # 儀表板頁面
│   │   ├── login/            # 登入頁面
│   │   └── ... (其他功能模組)
│   ├── components/           # React 組件
│   │   ├── AsyncDataFetcher.tsx
│   │   ├── ChargerContributionCard.js
│   │   ├── ChargingStatusCard.js
│   │   ├── CPCard.js
│   │   ├── CPListCard.js
│   │   ├── DisclaimerFooter.js
│   │   ├── ElectricityRateTableCard.js
│   │   ├── ErrorMonitorCard.js
│   │   ├── LoadingSpinner.tsx
│   │   ├── PowerOverviewCard.js
│   │   ├── RateTableManager.js
│   │   └── ...
│   ├── lib/                  # 輔助函式庫和工具
│   │   ├── database/         # 資料庫服務和工具
│   │   └── emsAllocator.js   # EMS 分配演算法純函式
│   ├── models/               # 資料庫模型定義
│   └── servers/              # 後端伺服器邏輯
│       ├── ocppController.js # OCPP 核心邏輯，包含 EMS 整合
│       └── ocppServer.js     # OCPP WebSocket 伺服器啟動點
├── tests/                    # 測試文件
│   ├── emsAllocator.test.js  # EMS 單元測試
│   ├── emsConsistency.test.js # EMS 一致性測試
│   └── emsIntegration.test.js # EMS 整合測試
└── ... (其他設定檔)
```

---
**注意**: 本文件會隨著專案的發展而更新。
