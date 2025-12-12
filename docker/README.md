# CSMS Docker 環境管理

此資料夾包含 CSMS 項目的 Docker 配置和啟動腳本。

## 📁 文件結構

```
docker/
├── Dockerfile.prod          # Production multi-stage Dockerfile
├── Dockerfile.dev           # Development multi-stage Dockerfile
├── docker-compose.prod.yml  # Production docker-compose 配置
├── docker-compose.dev.yml   # Development docker-compose 配置
├── start.prod.bat          # Windows Production 啟動腳本
├── start.dev.bat           # Windows Development 啟動腳本
├── start.prod.sh           # Linux/Mac Production 啟動腳本
├── start.dev.sh            # Linux/Mac Development 啟動腳本
└── README.md               # 本文檔
```

## 🚀 快速開始

### Windows

**啟動 Production 環境：**
```bash
cd docker
start.prod.bat
```

**啟動 Development 環境：**
```bash
cd docker
start.dev.bat
```

### Linux / Mac

**啟動 Production 環境：**
```bash
cd docker
bash start.prod.sh
```

**啟動 Development 環境：**
```bash
cd docker
bash start.dev.sh
```

## 📋 環境詳情

### Production 環境 (docker-compose.prod.yml)

- **Web 服務**
  - 容器名稱：`csms-web-prod`
  - 端口：3000
  - 環境文件：`.env.production`
  - Dockerfile：`Dockerfile.prod`

- **OCPP 服務**
  - 容器名稱：`csms-ocpp-prod`
  - 端口：8089
  - 環境文件：`.env.production`
  - Dockerfile：`Dockerfile.prod`

### Development 環境 (docker-compose.dev.yml)

- **Dev 服務（合併 Web + OCPP）**
  - 容器名稱：`csms-dev`
  - Web 端口：3001
  - OCPP 端口：8088
  - 環境文件：`.env.development`
  - Dockerfile：`Dockerfile.dev`
  - 啟動命令：`npm run dev:all`

## 🔧 手動命令

如需手動操作，可在 `docker` 資料夾執行以下命令：

### Production

```bash
# 啟動
docker-compose -f docker-compose.prod.yml up -d

# 停止
docker-compose -f docker-compose.prod.yml down

# 查看日誌
docker-compose -f docker-compose.prod.yml logs -f

# 重新構建
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Development

```bash
# 啟動
docker-compose -f docker-compose.dev.yml up -d

# 停止
docker-compose -f docker-compose.dev.yml down

# 查看日誌
docker-compose -f docker-compose.dev.yml logs -f

# 重新構建
docker-compose -f docker-compose.dev.yml build --no-cache
```

## 🌐 訪問地址

### Production
- Web App：http://localhost:3000
- OCPP Server：ws://localhost:8089

### Development
- Web App：http://localhost:3001
- OCPP Server：ws://localhost:8088

## ⚙️ 環境變量

### Production (.env.production)
在根目錄需要有 `.env.production` 文件

### Development (.env.development)
在根目錄需要有 `.env.development` 文件

## 🐳 Docker 網絡

兩個環境都使用外部網絡 `csms-network`。確保該網絡已創建：

```bash
docker network create csms-network
```

## 📝 注意事項

1. 啟動前確保 Docker Desktop 已運行
2. 確保 `.env.production` 和 `.env.development` 文件存在
3. PROD 和 DEV 環境不會相互干擾，可同時運行
4. 啟動腳本會自動清理懸掛的鏡像但保留 volumes

## 🛠️ 故障排查

### 權限問題
如在 Linux/Mac 上遇到權限問題：
```bash
chmod +x start.prod.sh
chmod +x start.dev.sh
```

### Docker 未運行
確保 Docker Desktop 已啟動並運行

### 端口被占用
檢查是否有其他應用佔用 3000/3001 和 8088/8089 端口

### 網絡問題
確保 `csms-network` 已創建：
```bash
docker network create csms-network 2>/dev/null || true
```
