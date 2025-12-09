import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordsPage from './RecordsPage';
import { FilterField } from './types/filter';

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

const getDefaultRange = (days = 30) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

const actionTypeMap: Record<string, string> = {
  '建立': 'CREATE',
  '更新': 'UPDATE',
  '刪除': 'DELETE',
  '登入': 'LOGIN',
  '登出': 'LOGOUT',
  '匯出': 'EXPORT',
  '匯入': 'IMPORT',
  '核准': 'APPROVE',
  '駁回': 'REJECT',
  '重置': 'RESET'
};

const statusMap: Record<string, string> = {
  '成功': 'SUCCESS',
  '失敗': 'FAILED'
};

const filterConfig: FilterField[] = [
  { id: 'actionType', label: '類型', type: 'select', options: Object.keys(actionTypeMap) },
  { id: 'status', label: '狀態', type: 'select', options: Object.keys(statusMap) }
];

interface DateRange {
  start: string;
  end: string;
}

export default function SystemRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultRange = useMemo(() => getDefaultRange(30), []);
  const [appliedRange, setAppliedRange] = useState<DateRange>(defaultRange);
  const rangeRef = useRef<DateRange>(defaultRange);

  const fetchRecords = useCallback(async (paramsInput?: Partial<DateRange> & Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const currentRange = rangeRef.current;
      const appliedStart = paramsInput?.start ?? currentRange.start;
      const appliedEnd = paramsInput?.end ?? currentRange.end;

      const params = new URLSearchParams({ limit: '500' });

      if (appliedStart) {
        params.set('startDate', appliedStart);
      }

      if (appliedEnd) {
        params.set('endDate', appliedEnd);
      }

      //加上進階篩選條件
      if (paramsInput?.actionType) params.set('actionType', paramsInput.actionType);
      if (paramsInput?.status) params.set('status', paramsInput.status);

      const response = await fetch(`/api/reports/system?${params.toString()}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || '無法取得系統紀錄');
      }

      setRecords(Array.isArray(json.data?.records) ? json.data.records : []);

      const updatedRange: DateRange = {
        start: appliedStart,
        end: appliedEnd
      };

      rangeRef.current = updatedRange;
      setAppliedRange(updatedRange);
    } catch (err) {
      console.error('Fetch system records error:', err);
      setError(err instanceof Error ? err.message : '未知錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    rangeRef.current = defaultRange;
    setAppliedRange(defaultRange);
    fetchRecords(defaultRange);
  }, [defaultRange, fetchRecords]);

  const handleFilter = useCallback(async (start: string, end: string) => {
    await fetchRecords({ start, end });
  }, [fetchRecords]);

  const handleClear = useCallback(async () => {
    const resetRange = getDefaultRange(30);
    await fetchRecords(resetRange);
  }, [fetchRecords]);

  const handleRefresh = useCallback(async () => {
    await fetchRecords();
  }, [fetchRecords]);

  const filtersRef = useRef<Record<string, any>>({});

  const handleExport = useCallback(async () => {
    try {
      const { start, end } = rangeRef.current;
      const filters = filtersRef.current;
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      params.set('format', 'xlsx');

      // 將進階篩選加到 URL
      if (filters.actionType) params.set('actionType', filters.actionType);
      if (filters.status) params.set('status', filters.status);

      console.info('開始導出系統記錄', {
        url: `/api/reports/system?${params.toString()}`,
        range: { start, end }
      });

      const response = await fetch(`/api/reports/system?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream;q=0.9, */*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error('下載失敗');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `系統記錄_${start ?? ''}_${end ?? ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('導出系統記錄失敗:', err);
      alert('導出失敗，請稍後再試');
    }
  }, [records]);

  return (
    <RecordsPage
      title="系統記錄列表"
      columns={columns}
      data={records}
      filterTitle="系統記錄日期篩選"
      onFilter={handleFilter}
      onExport={handleExport}
      onRefresh={handleRefresh}
      onClear={handleClear}
      loading={loading}
      error={error}
      initialStartDate={appliedRange.start}
      initialEndDate={appliedRange.end}
      filterable={true}
      filterConfig={filterConfig}
      onAdvancedFilter={(filters) => {
        // 保存最後一次進階篩選，用於匯出，並呼叫 fetchRecords
        filtersRef.current = filters || {};
        // 合併日期 + 進階篩選，呼叫 fetchRecords
        fetchRecords({ ...rangeRef.current, ...filters });
      }}
    />
  );
}
