# CSMS Monorepo 架构文档

## 📁 项目结构

```
csms/
├── src/                          # Next.js 主项目
│   ├── app/                      # Next.js App Router
│   ├── components/               # React 组件
│   ├── lib/
│   │   └── ocppClient.ts        # ⭐ OCPP API 客户端
│   └── services/                 # 业务逻辑
│
├── ocpp-core/                    # ⭐ OCPP + EMS 微服务 (Workspace)
│   ├── src/
│   │   ├── api/
│   │   │   ├── mainAppRoutes.ts # ⭐ 主项目调用的REST API
│   │   │   └── routes/          # OCPP内部路由
│   │   ├── ocpp/                # OCPP服务器
│   │   ├── ems/                 # EMS分配器
│   │   ├── rabbitmq/            # 消息队列
│   │   └── index.ts             # 入口文件
│   ├── package.json
│   └── .env.example
│
├── package.json                  # Monorepo 根配置
├── .env.example
└── README.md
```

## 🔌 通信架构

### 主项目 → ocpp-core (HTTP REST API)

```typescript
// 主项目: src/lib/ocppClient.ts
import { getChargers, startCharging } from '@/lib/ocppClient';

// 获取充电器列表
const chargers = await getChargers();

// 启动充电
await startCharging('CP001', { connectorId: 1, idTag: 'USER001' });
```

### ocpp-core → 主项目 (RabbitMQ 事件推送)

```typescript
// ocpp-core 发布事件
rabbitmq.publish('charger-events', 'charger.status.changed', {
  chargerId: 'CP001',
  status: 'Charging',
  power: 7000
});

// 主项目监听事件 (可选)
const channel = await amqp.connect();
channel.consume('main-app-queue', (msg) => {
  const event = JSON.parse(msg.content.toString());
  // 更新UI或数据库
});
```

## 🚀 运行命令

### 开发模式

```bash
# 只启动 Next.js 主项目
npm run dev

# 只启动 OCPP Core
npm run ocpp:dev

# 同时启动两个服务
npm run dev:all
```

### 构建

```bash
# 构建所有项目
npm run build:all

# 只构建 OCPP Core
npm run ocpp:build
```

### 测试

```bash
# 测试 OCPP Core
npm run ocpp:test
```

## 📡 API 接口清单

### Charger APIs

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/chargers` | 获取所有充电器状态 |
| GET | `/api/chargers/:id/status` | 获取单个充电器状态 |
| POST | `/api/chargers/:id/start` | 启动充电 |
| POST | `/api/chargers/:id/stop` | 停止充电 |

### EMS APIs

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/ems/status` | 获取EMS状态 |
| POST | `/api/ems/allocate` | 执行功率分配 |
| PUT | `/api/ems/config` | 更新EMS配置 |

### Transaction APIs

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/transactions` | 获取交易记录 |

### WebSocket

| 端点 | 说明 |
|------|------|
| `ws://localhost:3001/ws/chargers` | 实时充电器状态更新 |

## 🔧 环境变量配置

### 主项目 (.env.local)

```env
NEXT_PUBLIC_OCPP_API_URL=http://localhost:3001
DATABASE_URL=mysql://user:password@localhost:3306/csms
```

### OCPP Core (ocpp-core/.env)

```env
PORT=3001
OCPP_WS_PORT=8080
EMS_MODE=dynamic
RABBITMQ_ENABLED=true
RABBITMQ_URL=amqp://localhost:5672
```

## 📦 依赖管理

### 安装依赖

```bash
# 安装所有workspace的依赖
npm install

# 为特定workspace安装包
npm install -w ocpp-core express
```

### 更新依赖

```bash
# 更新所有依赖
npm update

# 更新特定workspace的依赖
npm update -w ocpp-core
```

## 🎯 集成示例

### 在主项目页面中使用

```typescript
// app/chargers/page.tsx
import { getChargers } from '@/lib/ocppClient';

export default async function ChargersPage() {
  const chargers = await getChargers();
  
  return (
    <div>
      {chargers.map(charger => (
        <ChargerCard key={charger.id} charger={charger} />
      ))}
    </div>
  );
}
```

### 实时更新

```typescript
// components/ChargerStatus.tsx
'use client';

import { createWebSocketConnection } from '@/lib/ocppClient';
import { useEffect, useState } from 'react';

export function ChargerStatus() {
  const [status, setStatus] = useState({});
  
  useEffect(() => {
    const ws = createWebSocketConnection((event) => {
      setStatus(prev => ({...prev, [event.chargerId]: event.data}));
    });
    
    return () => ws.close();
  }, []);
  
  return <div>{/* 显示状态 */}</div>;
}
```

## 🏗️ 核心优势

| 优势 | 说明 |
|------|------|
| **清晰解耦** | 主项目和微服务通过标准HTTP API通信 |
| **独立部署** | ocpp-core可独立运行和部署 |
| **类型安全** | TypeScript确保API调用的类型正确 |
| **易于测试** | 可以Mock API进行单元测试 |
| **统一管理** | npm workspace统一管理依赖和构建 |
| **实时更新** | WebSocket支持实时数据推送 |

## 🔄 开发流程

1. **启动服务**
   ```bash
   npm run dev:all
   ```

2. **访问应用**
   - Next.js: http://localhost:3000
   - OCPP Core: http://localhost:3001

3. **开发调试**
   - 主项目修改会自动热重载
   - OCPP Core修改会自动重启

4. **测试**
   ```bash
   npm run ocpp:test
   ```

## 📝 待实现功能 (TODO)

在 `ocpp-core/src/api/mainAppRoutes.ts` 中，需要将TODO替换为实际实现：

```typescript
// TODO: 从ocppServer获取所有充电器状态
// 改为:
const ocppServer = getOcppServer();
const chargers = ocppServer.getAllChargers();
```

类似的还有其他API端点的实现。
