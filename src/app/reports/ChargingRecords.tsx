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

// 動態 filterConfig
const getFilterConfig = (meterOptions: string[], chargerOptions: string[]): FilterField[] => [
  { id: 'meterNo', label: '電表', type: 'multi-select', options: meterOptions },
  { id: 'charger', label: '充電樁', type: 'multi-select', options: chargerOptions }
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
  // 動態選項  
  const [meterOptions, setMeterOptions] = useState<string[]>([]);
  const [chargerOptions, setChargerOptions] = useState<string[]>([]);
  // 新增 state 追蹤多選
  //const [selectedMeters, setSelectedMeters] = useState<string[]>([]); 
  //const [selectedChargers, setSelectedChargers] = useState<string[]>([]);

  // 抓充電樁選項，依選中的電表過濾
  const fetchChargersByMeters = useCallback(async (meters: string[]) => { // NEW
    try {
      let url = '/api/guns/search?search=';
      if (meters.length > 0) {
        url = `/api/guns/search?meterNo=${meters.join(',')}`; // MODIFIED
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setChargerOptions(json.data || []);
      }
    } catch (err) {
      console.error('抓充電樁失敗', err);
    }
  }, []);
  
  
    interface FetchParams extends Partial<DateRange> {
    meterNo?: string[];
    charger?: string[];
  }

  const fetchRecords = useCallback(async (params: FetchParams = {}) => {
    setLoading(true);
    setError(null);

    try {
      const currentRange = rangeRef.current;
      const appliedStart = params?.start ?? currentRange.start;
      const appliedEnd = params?.end ?? currentRange.end;

      const query  = new URLSearchParams({ limit: '500' });

      if (appliedStart) {
        query .set('startDate', appliedStart);
      }

      if (appliedEnd) {
        query .set('endDate', appliedEnd);
      }

      // 處理進階篩選條件
      if (params.charger && params.charger.length > 0) {
        query.set('charger', params.charger.join(','));
      }

      const response = await fetch(`/api/reports/charging?${query .toString()}`);
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

  // 載入進階篩選選項（預設空字串查詢 Top N）
  useEffect(() => {
    let ignore = false;
    const loadOptions = async () => {
        try {
        const metersRes = await fetch(`/api/meters?search=`);
        const metersJson = await metersRes.json();
        if (!ignore) {
          setMeterOptions(Array.isArray(metersJson?.data) ? metersJson.data : []);
          fetchChargersByMeters([]); // NEW: 初始抓全部充電樁
        }
      } catch (e) {
        console.error('載入進階篩選選項失敗', e);
      }
    };
    loadOptions();
    return () => { ignore = true; };
  }, [fetchChargersByMeters]);
  // onAdvancedFilter 處理：電表改變時自動刷新充電樁選項
  const handleAdvancedFilter = useCallback((filters: Record<string, any>) => {
    const meters: string[] = filters.meterNo || [];
    // 更新充電樁選項
    fetchChargersByMeters(meters);
  
    // 呼叫 fetchRecords
    fetchRecords({ ...rangeRef.current, ...filters });
  }, [fetchRecords, fetchChargersByMeters]);

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
      filterConfig={useMemo(() => getFilterConfig( meterOptions, chargerOptions), [ meterOptions, chargerOptions])}
      onAdvancedFilter={handleAdvancedFilter}
      /* onAdvancedFilter={(filters) => {
      // 合併日期 + 進階篩選，呼叫 fetchRecords
      fetchRecords({ ...rangeRef.current, ...filters });
      }} */
    />
  );
}
