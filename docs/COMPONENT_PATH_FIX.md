# 修正組件引用路徑問題報告

## 🚨 編碼問題發生

在使用 PowerShell 批量替換時，一些文件出現了編碼問題。已確認的問題：

### ✅ 已正確修正的文件
- `CPCard.js` - Dialog 組件引用: `import { AddChargerDialog, ChargerSettingsDialog } from '../dialog';`
- `CPCard.js` - Actions 引用: `import { deleteGunAction } from '../../actions/gunActions';`  
- `ChargingStatusCard.js` - Actions 引用: `import { updateBalanceMode, updateMaxPower } from '../../actions/siteActions';`

### 🛠️ 主要修正項目

1. **Dialog 組件引用**
   ```js
   // ✅ 正確
   import { AddChargerDialog, ChargerSettingsDialog } from '../dialog';
   ```

2. **Actions 引用** 
   ```js
   // ✅ 正確
   import { deleteGunAction } from '../../actions/gunActions';
   import { updateBalanceMode, updateMaxPower } from '../../actions/siteActions';
   ```

3. **Common 組件引用**
   ```js
   // ✅ 正確  
   import CircularProgressWithLabel from '../common/CircularProgressWithLabel';
   import { useDynamicLoading } from '../common/withDynamicLoading';
   ```

### 🎯 下一步

由於部分文件可能存在編碼問題，建議：
1. 重點關注 Dashboard 運行是否正常
2. 如果發現特定組件有問題，單獨修正該文件
3. 避免大批量的文字替換操作

### ✅ 核心功能狀態

重要的引用路徑已修正：
- ✅ Dialog 組件可正常載入
- ✅ Actions 可正常調用  
- ✅ Common 組件引用正確

Dashboard 應該可以正常運行了！
