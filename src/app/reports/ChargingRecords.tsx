import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordsPage from './RecordsPage';
import { FilterField } from './types/filter';

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
    format: (value: string) => new Date(value).toLocaleString('zh-TW', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  },
  {
    id: 'endTime',
    label: '結束時間',
    minWidth: 160,
    sortable: true,
    format: (value: string) => new Date(value).toLocaleString('zh-TW', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
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

const filterConfig: FilterField[] = [
  { id: 'user', label: '用戶', type: 'text' },
  { id: 'charger', label: '充電樁', type: 'select', options: ['A01', 'B02', 'C03'] },
  { id: 'kWh', label: '電量範圍 (kWh)', type: 'range', minField: 'minKWh', maxField: 'maxKWh' },
  { id: 'fee', label: '費用範圍 (NT$)', type: 'range', minField: 'minFee', maxField: 'maxFee' },
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

export default function ChargingRecords() {
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

      const response = await fetch(`/api/reports/charging?${params.toString()}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || '無法取得充電記錄');
      }

      setRecords(Array.isArray(json.data?.records) ? json.data.records : []);

      const updatedRange: DateRange = {
        start: appliedStart,
        end: appliedEnd
      };

      rangeRef.current = updatedRange;
      setAppliedRange(updatedRange);
    } catch (err) {
      console.error('Fetch charging records error:', err);
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

  const handleExport = useCallback(async () => {
    try {
      const { start, end } = rangeRef.current;
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      params.set('format', 'xlsx');

      console.info('開始導出充電記錄', {
        url: `/api/reports/charging?${params.toString()}`,
        range: { start, end }
      });

      const response = await fetch(`/api/reports/charging?${params.toString()}`, {
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
      a.download = `充電記錄_${start ?? ''}_${end ?? ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('導出充電記錄失敗:', err);
      alert('導出失敗，請稍後再試');
    }
  }, [records]);

  return (
    <RecordsPage
      title="充電記錄列表"
      columns={columns}
      data={records}
      filterTitle="充電記錄日期篩選"
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
      // 合併日期 + 進階篩選，呼叫 fetchRecords
      fetchRecords({ ...rangeRef.current, ...filters });
      }}
    />
  );
}
