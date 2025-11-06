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

const getDefaultRange = (days = 30) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

const filterConfig: FilterField[] = [
  {
    id: 'type',
    label: '類型',
    type: 'select',
    options: ['儲值', '扣款', '退款']
  },
  {
    id: 'minAmount',
    label: '金額 (以上)',
    type: 'text'
  },
  {
    id: 'minBalance',
    label: '餘額 (以上)',
    type: 'text'
  }
];

interface DateRange {
  start: string;
  end: string;
}

export default function TransactionRecords() {
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
      if (paramsInput?.type) params.set('type', paramsInput.type);
      if (paramsInput?.minAmount) params.set('minAmount', paramsInput.minAmount);
      if (paramsInput?.minBalance) params.set('minBalance', paramsInput.minBalance);

      const response = await fetch(`/api/reports/transactions?${params.toString()}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || '無法取得交易記錄');
      }

      setRecords(Array.isArray(json.data?.records) ? json.data.records : []);

      const updatedRange: DateRange = {
        start: appliedStart,
        end: appliedEnd
      };

      rangeRef.current = updatedRange;
      setAppliedRange(updatedRange);
    } catch (err) {
      console.error('Fetch transaction records error:', err);
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

      // Debug log to verify export trigger and URL
      console.info('開始導出交易記錄', {
        url: `/api/reports/transactions?${params.toString()}`,
        range: { start, end }
      });

      const response = await fetch(`/api/reports/transactions?${params.toString()}`, {
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
      a.download = `交易記錄_${start ?? ''}_${end ?? ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('導出交易記錄失敗:', err);
      alert('導出失敗，請稍後再試');
    }
  }, [records]); 

  return (
    <RecordsPage
      title="交易記錄列表"
      columns={columns}
      data={records}
      filterTitle="交易記錄日期篩選"
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
