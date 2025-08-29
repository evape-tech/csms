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
    id: 'time',
    label: '時間',
    minWidth: 160,
    sortable: true,
    format: (value: string) => new Date(value).toLocaleString('zh-TW')
  },
  {
    id: 'type',
    label: '類型',
    minWidth: 100,
    sortable: true,
    format: (value: string) => {
      const colors: { [key: string]: string } = {
        '儲值': '#4caf50',
        '扣款': '#f44336',
        '退款': '#ff9800'
      };
      return `<span style="color: ${colors[value] || '#000'}">${value}</span>`;
    }
  },
  {
    id: 'amount',
    label: '金額 (NT$)',
    minWidth: 120,
    align: 'right' as const,
    sortable: true,
    format: (value: number) => `$${value.toLocaleString()}`
  },
  {
    id: 'balance',
    label: '餘額 (NT$)',
    minWidth: 120,
    align: 'right' as const,
    sortable: true,
    format: (value: number) => `$${value.toLocaleString()}`
  }
];

// 模擬交易紀錄數據
const mockData = [
  { id: 1, user: '王小明', time: '2024-05-01T15:45:00', type: '儲值', amount: 500, balance: 750 },
  { id: 2, user: '李小美', time: '2024-05-01T17:30:00', type: '扣款', amount: 52, balance: 320 },
  { id: 3, user: '張大華', time: '2024-05-02T10:40:00', type: '儲值', amount: 1000, balance: 1200 },
  { id: 4, user: '陳美玲', time: '2024-05-02T14:15:00', type: '扣款', amount: 65, balance: 485 },
  { id: 5, user: '林志偉', time: '2024-05-03T09:30:00', type: '儲值', amount: 300, balance: 680 },
  { id: 6, user: '黃小琪', time: '2024-05-03T16:45:00', type: '扣款', amount: 90, balance: 245 },
  { id: 7, user: '吳建國', time: '2024-05-04T11:20:00', type: '儲值', amount: 800, balance: 1024 },
  { id: 8, user: '蔡文娟', time: '2024-05-04T15:50:00', type: '扣款', amount: 85, balance: 339 },
];

export default function TransactionRecords() {
  const handleExport = () => {
    // 實現導出邏輯
    console.log('導出交易記錄');
    // 可以實現 CSV 或 Excel 導出
  };

  return (
    <RecordsPage
      title="交易記錄列表"
      columns={columns}
      data={mockData}
      filterTitle="交易記錄日期篩選"
      onExport={handleExport}
    />
  );
}
