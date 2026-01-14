# ✅ Workspace Monorepo 配置完成

## 📦 已完成的工作

### 1. **清理项目结构**
- ✅ 删除不必要的 `packages/` 文件夹
- ✅ 保持简洁的 monorepo 结构

### 2. **配置 npm workspace**
- ✅ 根 `package.json` 配置 workspaces
- ✅ 添加便捷的 npm 脚本命令
- ✅ 验证 workspace 配置正确

### 3. **创建标准化 API**
- ✅ `src/lib/ocppClient.ts` - 主项目的 API 客户端
- ✅ `ocpp-core/src/api/mainAppRoutes.ts` - OCPP Core 的 REST API
- ✅ 集成到 `ocpp-core/src/index.ts`

### 4. **环境变量配置**
- ✅ `.env.example` - 主项目环境变量模板
- ✅ `ocpp-core/.env.example` - OCPP Core 环境变量模板

### 5. **文档完善**
- ✅ `ARCHITECTURE.md` - 详细架构说明
- ✅ `README.md` - 添加 monorepo 说明
- ✅ `src/lib/ocppClient.example.tsx` - 使用示例

---

## 🏗️ 当前架构

```
csms/
├── src/                          # Next.js 主项目
│   └── lib/
│       ├── ocppClient.ts        # ⭐ API 客户端
│       └── ocppClient.example.tsx
│
├── ocpp-core/                    # ⭐ OCPP + EMS 微服务 (Workspace)
│   └── src/
│       ├── api/
│       │   └── mainAppRoutes.ts # ⭐ REST API
│       ├── ocpp/
│       ├── ems/
│       └── index.ts
│
├── package.json                  # workspaces: ["ocpp-core"]
├── .env.example
└── ARCHITECTURE.md
```

---

## 🚀 立即可用的命令

```bash
# 开发
npm run dev              # 只启动 Next.js
npm run ocpp:dev         # 只启动 OCPP Core
npm run dev:all          # 同时启动两个服务

# 构建
npm run build            # 只构建 Next.js
npm run ocpp:build       # 只构建 OCPP Core
npm run build:all        # 构建所有项目

# 测试
npm run ocpp:test        # 测试 OCPP Core

# 安装依赖
npm install              # 为所有 workspace 安装依赖
npm install -w ocpp-core # 为特定 workspace 安装
```

---

## 💡 如何使用

### 在主项目中调用 OCPP Core

```typescript
// app/chargers/page.tsx
import { getChargers } from '@/lib/ocppClient';

export default async function Page() {
  const chargers = await getChargers();
  return <div>...</div>;
}
```

### 配置环境变量

1. 复制模板文件：
```bash
cp .env.example .env.local
cp ocpp-core/.env.example ocpp-core/.env
```

2. 配置主项目环境变量 (`.env.local`):
```env
NEXT_PUBLIC_OCPP_API_URL=http://localhost:3001
```

3. 配置 OCPP Core 环境变量 (`ocpp-core/.env`):
```env
PORT=3001
EMS_MODE=dynamic
RABBITMQ_ENABLED=true
```

---

## 🔧 下一步需要实现

在 `ocpp-core/src/api/mainAppRoutes.ts` 中，需要将 `TODO` 替换为实际实现：

1. **连接到 OCPP Server**
```typescript
// TODO: 从ocppServer获取所有充电器状态
// 改为:
import { getOcppServer } from '../ocpp/server';
const ocppServer = getOcppServer();
const chargers = ocppServer.getAllChargers();
```

2. **连接到 EMS Allocator**
```typescript
// TODO: 从emsAllocator获取状态
// 改为:
import { emsAllocator } from '../ems/allocator';
const status = emsAllocator.getStatus();
```

3. **实现充电控制**
```typescript
// TODO: 调用ocppServer的RemoteStartTransaction
// 改为:
await ocppServer.sendRemoteStartTransaction(chargerId, connectorId, idTag);
```

---

## 📊 API 接口列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chargers` | GET | 获取所有充电器 |
| `/api/chargers/:id/status` | GET | 获取单个充电器状态 |
| `/api/chargers/:id/start` | POST | 启动充电 |
| `/api/chargers/:id/stop` | POST | 停止充电 |
| `/api/ems/status` | GET | 获取 EMS 状态 |
| `/api/ems/allocate` | POST | 执行功率分配 |
| `/api/ems/config` | PUT | 更新 EMS 配置 |
| `/api/transactions` | GET | 获取交易记录 |
| `/ws/chargers` | WS | 实时更新 |

---

## ✨ 核心优势

| 优势 | 说明 |
|------|------|
| ✅ **清晰解耦** | 主项目和 OCPP Core 通过标准 HTTP API 通信 |
| ✅ **类型安全** | TypeScript 类型定义，避免运行时错误 |
| ✅ **独立运行** | 每个 workspace 都可以独立启动和部署 |
| ✅ **统一管理** | npm workspace 统一管理依赖和构建 |
| ✅ **易于测试** | 可以 Mock API 进行单元测试 |
| ✅ **实时更新** | WebSocket 支持实时数据推送 |

---

## 🎯 验证配置

运行以下命令验证配置是否正确：

```bash
# 1. 查看 workspace 列表
npm ls --depth=0

# 2. 启动 OCPP Core (应该在 3001 端口)
npm run ocpp:dev

# 3. 在另一个终端启动主项目
npm run dev

# 4. 测试 API 是否可访问
# 浏览器访问: http://localhost:3001/health
```

---

## 📚 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 完整架构说明
- [WORKSPACE_SETUP.md](./WORKSPACE_SETUP.md) - Workspace 使用指南
- [ocpp-core/README.md](./ocpp-core/README.md) - OCPP Core 文档
- [src/lib/ocppClient.example.tsx](./src/lib/ocppClient.example.tsx) - 使用示例

---

**配置完成！现在可以开始开发了 🚀**
