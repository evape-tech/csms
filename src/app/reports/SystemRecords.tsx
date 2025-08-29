import React from 'react';
import RecordsPage from './RecordsPage';

const columns = [
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
    minWidth: 120,
    sortable: true,
    format: (value: string) => {
      const colors: { [key: string]: string } = {
        '系統啟動': '#4caf50',
        '設備連接': '#2196f3',
        '錯誤': '#f44336',
        '維護': '#ff9800',
        '警告': '#ff9800'
      };
      return `<span style="color: ${colors[value] || '#000'}">${value}</span>`;
    }
  },
  {
    id: 'description',
    label: '描述',
    minWidth: 200,
    sortable: false
  },
  {
    id: 'status',
    label: '狀態',
    minWidth: 100,
    align: 'center' as const,
    sortable: true,
    format: (value: string) => {
      const colors: { [key: string]: string } = {
        '成功': '#4caf50',
        '錯誤': '#f44336',
        '警告': '#ff9800'
      };
      return `<span style="color: ${colors[value] || '#000'}">${value}</span>`;
    }
  }
];

// 模擬系統紀錄數據
const mockData = [
  { id: 1, time: '2024-05-01T14:30:00', type: '系統啟動', description: '系統正常啟動', status: '成功' },
  { id: 2, time: '2024-05-01T15:45:00', type: '設備連接', description: 'CP-01連接成功', status: '成功' },
  { id: 3, time: '2024-05-01T16:20:00', type: '錯誤', description: 'CP-03連線失敗', status: '錯誤' },
  { id: 4, time: '2024-05-02T09:15:00', type: '維護', description: '系統備份完成', status: '成功' },
  { id: 5, time: '2024-05-02T11:30:00', type: '設備連接', description: 'CP-04連接成功', status: '成功' },
  { id: 6, time: '2024-05-02T14:45:00', type: '警告', description: 'CP-02電壓異常', status: '警告' },
  { id: 7, time: '2024-05-03T08:20:00', type: '系統啟動', description: '系統重新啟動', status: '成功' },
  { id: 8, time: '2024-05-03T16:10:00', type: '維護', description: '資料庫優化完成', status: '成功' },
  { id: 9, time: '2024-05-04T10:30:00', type: '錯誤', description: '網路連接中斷', status: '錯誤' },
  { id: 10, time: '2024-05-04T15:20:00', type: '設備連接', description: 'CP-02重新連接', status: '成功' },
];

export default function SystemRecords() {
  const handleExport = () => {
    // 實現導出邏輯
    console.log('導出系統記錄');
    // 可以實現 CSV 或 Excel 導出
  };

  return (
    <RecordsPage
      title="系統記錄列表"
      columns={columns}
      data={mockData}
      filterTitle="系統記錄日期篩選"
      onExport={handleExport}
    />
  );
}
