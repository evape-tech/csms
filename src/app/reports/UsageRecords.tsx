import React from 'react';
import RecordsPage from './RecordsPage';

const columns = [
  {
    id: 'user',
    label: '用戶',
    minWidth: 120,
    sortable: true
  },
  {
    id: 'charger',
    label: '充電樁',
    minWidth: 100,
    sortable: true
  },
  {
    id: 'date',
    label: '日期',
    minWidth: 120,
    sortable: true,
    format: (value: string) => new Date(value).toLocaleDateString('zh-TW')
  },
  {
    id: 'duration',
    label: '使用時間',
    minWidth: 120,
    sortable: true
  },
  {
    id: 'kWh',
    label: '電量 (kWh)',
    minWidth: 100,
    align: 'right' as const,
    sortable: true,
    format: (value: number) => `${value.toFixed(2)} kWh`
  }
];

// 模擬使用紀錄數據
const mockData = [
  { id: 1, user: '王小明', charger: 'CP-01', date: '2024-05-01', duration: '1小時15分鐘', kWh: 12.5 },
  { id: 2, user: '李小美', charger: 'CP-03', date: '2024-05-01', duration: '1小時10分鐘', kWh: 8.2 },
  { id: 3, user: '張大華', charger: 'CP-02', date: '2024-05-02', duration: '1小時25分鐘', kWh: 15.8 },
  { id: 4, user: '陳美玲', charger: 'CP-01', date: '2024-05-02', duration: '1小時30分鐘', kWh: 10.3 },
  { id: 5, user: '林志偉', charger: 'CP-04', date: '2024-05-03', duration: '1小時45分鐘', kWh: 18.7 },
  { id: 6, user: '黃小琪', charger: 'CP-02', date: '2024-05-03', duration: '1小時30分鐘', kWh: 14.2 },
  { id: 7, user: '吳建國', charger: 'CP-03', date: '2024-05-04', duration: '1小時25分鐘', kWh: 11.9 },
  { id: 8, user: '蔡文娟', charger: 'CP-01', date: '2024-05-04', duration: '1小時30分鐘', kWh: 13.4 },
];

export default function UsageRecords() {
  const handleExport = () => {
    // 實現導出邏輯
    console.log('導出使用記錄');
    // 可以實現 CSV 或 Excel 導出
  };

  return (
    <RecordsPage
      title="使用記錄列表"
      columns={columns}
      data={mockData}
      filterTitle="使用記錄日期篩選"
      onExport={handleExport}
    />
  );
}
