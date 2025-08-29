# 動態載入組件的實現方案比較

## 方案一：Page 層級動態載入（目前使用）

```tsx
// src/app/dashboard/page.tsx
"use client";
import dynamic from 'next/dynamic';
import { Skeleton } from '@mui/material';

const ChargingStatusCard = dynamic(() => import('@/components/ChargingStatusCard'), {
  loading: () => <Skeleton variant="rectangular" width="100%" height={200} animation="wave" />,
  ssr: false
});

export default function Dashboard() {
  return (
    <div>
      <ChargingStatusCard />
    </div>
  );
}
```

**優點：**
- 在 Page 層級控制載入策略
- 可以精確控制何時載入組件
- 減少初始 bundle 大小

**缺點：**
- Page 需要了解每個組件的載入需求
- 重複的 dynamic import 配置
- 組件重用時需要重新配置

## 方案二：組件層級動態載入（推薦）

```jsx
// src/components/ChargingStatusCard.js
"use client";
import { useDynamicLoading } from './common/withDynamicLoading';

export default function ChargingStatusCard() {
  const { isLoading, stopLoading, LoadingSkeleton } = useDynamicLoading({ height: 200 });
  
  useEffect(() => {
    // 載入數據後調用 stopLoading()
    loadData().then(() => stopLoading());
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    // 實際組件內容
  );
}
```

**Page 使用：**
```tsx
// src/app/dashboard/page.tsx
import ChargingStatusCard from '@/components/ChargingStatusCard';

export default function Dashboard() {
  return (
    <div>
      <ChargingStatusCard /> {/* 自動處理載入狀態 */}
    </div>
  );
}
```

**優點：**
- 組件自包含，載入邏輯封裝在組件內部
- Page 層級簡潔，無需關心載入細節
- 組件重用性更好
- 更好的關注點分離

**缺點：**
- 組件 bundle 仍會在初始載入時包含
- 無法實現真正的代碼分割

## 方案三：混合方案（最佳實踐）

```jsx
// src/components/DynamicChargingStatusCard.js
"use client";
import dynamic from 'next/dynamic';
import { Skeleton } from '@mui/material';

const ChargingStatusCard = dynamic(() => import('./ChargingStatusCardImpl'), {
  loading: () => <Skeleton variant="rectangular" width="100%" height={200} animation="wave" />,
  ssr: false
});

export default ChargingStatusCard;
```

```jsx
// src/components/ChargingStatusCardImpl.js - 實際實現
export default function ChargingStatusCardImpl() {
  // 實際組件邏輯
}
```

**使用：**
```tsx
// src/app/dashboard/page.tsx
import ChargingStatusCard from '@/components/DynamicChargingStatusCard';

export default function Dashboard() {
  return <ChargingStatusCard />;
}
```

**優點：**
- 真正的代碼分割
- 組件自包含
- Page 層級簡潔
- 最佳載入性能

## 總結

根據你的需求，我建議使用 **方案三（混合方案）**：
1. 創建 `DynamicXxxCard.js` 文件處理動態載入
2. 將原實現移到 `XxxCardImpl.js`
3. Page 直接導入 Dynamic 版本

這樣既實現了代碼分割，又保持了組件的自包含性。
