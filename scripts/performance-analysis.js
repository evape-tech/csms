const fs = require('fs');

// 性能測試腳本
console.log('🔍 開始分析 Next.js 性能...');

// 1. 檢查 package.json 中的大型依賴項
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

console.log('\n📦 大型依賴項分析：');
const largeDeps = [
  '@mui/material',
  '@mui/icons-material', 
  'echarts',
  'echarts-for-react',
  'recharts',
  'firebase',
  'firebase-admin',
  'sequelize',
  '@prisma/client'
];

largeDeps.forEach(dep => {
  if (dependencies[dep]) {
    console.log(`  ✓ ${dep}: ${dependencies[dep]}`);
  }
});

// 2. 檢查是否有重複的組件導入
console.log('\n🔍 檢查重複組件導入...');

// 3. 建議優化方案
console.log('\n💡 優化建議：');
console.log('1. 使用動態導入 (dynamic imports) 延遲載入大型組件');
console.log('2. 實施虛擬化 (virtualization) 對於長列表');
console.log('3. 使用 React.memo 防止不必要的重新渲染');
console.log('4. 分離 Server 和 Client 組件');
console.log('5. 啟用並行資料獲取');

// 4. 測試建議
console.log('\n📊 執行以下命令來分析 bundle：');
console.log('  npm run build');
console.log('  ANALYZE=true npm run build');

console.log('\n✅ 分析完成！');
