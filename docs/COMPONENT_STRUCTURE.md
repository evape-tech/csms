# 組件資料夾結構說明

## 新的組織架構

```
src/components/
├── cards/                 # 卡片組件
│   ├── ChargingStatusCard.js     # 充電樁狀態卡片
│   ├── RealTimePowerCard.js      # 即時功率監控卡片
│   ├── ErrorMonitorCard.js       # 錯誤監控卡片
│   ├── CPListCard.js             # CP 列表卡片
│   ├── PowerOverviewCard.js      # 功率總覽卡片
│   ├── ElectricityRateTableCard.js  # 電費率表卡片
│   ├── RevenueStatisticsCard.js  # 營收統計卡片
│   ├── UsagePatternCard.js       # 使用模式卡片
│   ├── ChargerContributionCard.js # 充電器貢獻卡片
│   ├── CPCard.js                 # CP 卡片
│   └── index.js                  # 卡片組件索引
│
├── layout/                # 佈局組件
│   ├── DisclaimerFooter.js       # 免責聲明頁腳
│   ├── Sidebar.tsx               # 側邊欄
│   └── index.js                  # 佈局組件索引
│
├── ui/                    # UI 組件
│   ├── LoadingSpinner.tsx        # 載入指示器
│   ├── SuspenseWrapper.tsx       # Suspense 包裝器
│   ├── AsyncDataFetcher.tsx      # 異步數據獲取器
│   └── index.js                  # UI 組件索引
│
├── charts/                # 圖表組件
│   ├── EChartsBarAreaTemplates.js # ECharts 條形區域圖模板
│   ├── EChartsChargerTemplates.js # ECharts 充電器圖表模板
│   └── index.js                  # 圖表組件索引
│
├── navigation/            # 導航組件
│   ├── NavigationGroup.js        # 導航群組
│   └── index.js                  # 導航組件索引
│
├── dialog/                # 對話框組件
│   ├── AddChargerDialog.js       # 新增充電器對話框
│   ├── ChargerSettingsDialog.js  # 充電器設定對話框
│   └── index.js                  # 對話框組件索引
│
├── common/                # 通用組件與工具
│   ├── AnimatedNumber.js         # 動畫數字
│   ├── CircularProgressWithLabel.js # 帶標籤圓形進度條
│   ├── DimensionDatePicker.js    # 維度日期選擇器
│   ├── PowerOverviewIndicatorCard.js # 功率總覽指示卡
│   ├── ShimmerSkeleton.js        # 閃爍骨架屏
│   ├── RateTableManager.js       # 費率表管理器
│   ├── DynamicComponentWrapper.js # 動態組件包裝器
│   ├── withDynamicLoading.js     # 動態載入 HOC
│   └── index.js                  # 通用組件索引
│
├── DynamicComponents.js   # 動態組件集合 (向後兼容)
├── ChargingStatusCardDynamic.js # 動態充電狀態卡片 (示例)
└── index.js              # 主組件索引
```

## 使用方式

### 1. 按類別導入組件

```jsx
// 導入卡片組件
import { ChargingStatusCard, RealTimePowerCard } from '@/components/cards';

// 導入佈局組件
import { DisclaimerFooter, Sidebar } from '@/components/layout';

// 導入 UI 組件
import { LoadingSpinner, SuspenseWrapper } from '@/components/ui';

// 導入圖表組件
import { EChartsBarAreaTemplates } from '@/components/charts';

// 導入對話框組件
import { AddChargerDialog } from '@/components/dialog';

// 導入通用組件
import { AnimatedNumber, CircularProgressWithLabel } from '@/components/common';
```

### 2. 從主索引導入 (全部導出)

```jsx
import { 
  ChargingStatusCard, 
  RealTimePowerCard,
  DisclaimerFooter,
  LoadingSpinner,
  AnimatedNumber
} from '@/components';
```

### 3. 直接導入特定組件

```jsx
import ChargingStatusCard from '@/components/cards/ChargingStatusCard';
import DisclaimerFooter from '@/components/layout/DisclaimerFooter';
```

## 組織原則

1. **按功能分類**: 相似功能的組件放在同一資料夾
2. **模組化**: 每個資料夾都有自己的 index.js 索引文件
3. **清晰命名**: 資料夾和文件名稱一目了然
4. **向後兼容**: 保留舊的導入方式，通過主索引文件支援
5. **便於維護**: 相關組件集中管理，易於查找和修改

## 優點

- ✅ **更好的組織結構**: 按功能分類，易於尋找
- ✅ **模組化設計**: 每個模組獨立，可重用性高
- ✅ **樹搖優化**: 只導入需要的組件，減少 bundle 大小
- ✅ **維護友好**: 相關組件集中，修改更方便
- ✅ **開發體驗**: 清晰的導入路徑，IDE 自動完成支援更好
- ✅ **擴展性**: 新增組件時有明確的分類規則
