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
    id: 'startTime',
    label: '開始時間',
    minWidth: 160,
    sortable: true,
    format: (value: string) => new Date(value).toLocaleString('zh-TW')
  },
  {
    id: 'endTime',
    label: '結束時間',
    minWidth: 160,
    sortable: true,
    format: (value: string) => new Date(value).toLocaleString('zh-TW')
  },
  {
    id: 'kWh',
    label: '電量 (kWh)',
    minWidth: 100,
    align: 'right' as const,
    sortable: true,
    format: (value: number) => `${value.toFixed(2)} kWh`
  },
  {
    id: 'fee',
    label: '費用 (NT$)',
    minWidth: 100,
    align: 'right' as const,
    sortable: true,
    format: (value: number) => `$${value.toLocaleString()}`
  }
];

// 模擬充電紀錄數據
const mockData = [
  { id: 1, user: '王小明', charger: 'CP-01', startTime: '2024-05-01T14:30:00', endTime: '2024-05-01T15:45:00', kWh: 12.5, fee: 80 },
  { id: 2, user: '李小美', charger: 'CP-03', startTime: '2024-05-01T16:20:00', endTime: '2024-05-01T17:30:00', kWh: 8.2, fee: 52 },
  { id: 3, user: '張大華', charger: 'CP-02', startTime: '2024-05-02T09:15:00', endTime: '2024-05-02T10:40:00', kWh: 15.8, fee: 101 },
  { id: 4, user: '陳美玲', charger: 'CP-01', startTime: '2024-05-02T14:00:00', endTime: '2024-05-02T15:30:00', kWh: 10.3, fee: 65 },
  { id: 5, user: '林志偉', charger: 'CP-04', startTime: '2024-05-03T08:45:00', endTime: '2024-05-03T10:15:00', kWh: 18.7, fee: 119 },
  { id: 6, user: '黃小琪', charger: 'CP-02', startTime: '2024-05-03T16:30:00', endTime: '2024-05-03T18:00:00', kWh: 14.2, fee: 90 },
  { id: 7, user: '吳建國', charger: 'CP-03', startTime: '2024-05-04T11:20:00', endTime: '2024-05-04T12:45:00', kWh: 11.9, fee: 76 },
  { id: 8, user: '蔡文娟', charger: 'CP-01', startTime: '2024-05-04T15:10:00', endTime: '2024-05-04T16:40:00', kWh: 13.4, fee: 85 },
];

export default function ChargingRecords() {
  const handleExport = () => {
    // 實現導出邏輯
    console.log('導出充電記錄');
    // 可以實現 CSV 或 Excel 導出
  };

  return (
    <RecordsPage
      title="充電記錄列表"
      columns={columns}
      data={mockData}
      filterTitle="充電記錄日期篩選"
      onExport={handleExport}
    />
  );
}
