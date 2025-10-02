import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const getDefaultRange = (days = 30) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

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

  const fetchRecords = useCallback(async (range?: Partial<DateRange>) => {
    setLoading(true);
    setError(null);

    try {
      const currentRange = rangeRef.current;
      const appliedStart = range?.start ?? currentRange.start;
      const appliedEnd = range?.end ?? currentRange.end;

      const params = new URLSearchParams({ limit: '500' });

      if (appliedStart) {
        params.set('startDate', appliedStart);
      }

      if (appliedEnd) {
        params.set('endDate', appliedEnd);
      }

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

  const handleExport = useCallback(() => {
    console.info('導出系統記錄', {
      range: rangeRef.current,
      count: records.length
    });
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
    />
  );
}
