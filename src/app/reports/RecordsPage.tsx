import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import DateFilter from './DateFilter';
import RecordsTable from './RecordsTable';

interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string;
  sortable?: boolean;
}

interface RecordsPageProps {
  title: string;
  columns: Column[];
  data: any[];
  filterTitle?: string;
  onFilter?: (startDate: string, endDate: string) => Promise<void> | void;
  onExport?: () => void;
  onRefresh?: () => void;
  onClear?: () => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function RecordsPage({
  title,
  columns,
  data,
  filterTitle,
  onFilter,
  onExport,
  onRefresh,
  onClear,
  loading,
  error,
  initialStartDate,
  initialEndDate
}: RecordsPageProps) {
  const [startDate, setStartDate] = useState(initialStartDate ?? '');
  const [endDate, setEndDate] = useState(initialEndDate ?? '');
  const [filteredData, setFilteredData] = useState(data);

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  useEffect(() => {
    if (initialStartDate !== undefined) {
      setStartDate(initialStartDate);
    }
  }, [initialStartDate]);

  useEffect(() => {
    if (initialEndDate !== undefined) {
      setEndDate(initialEndDate);
    }
  }, [initialEndDate]);

  const handleFilter = async () => {
    if (onFilter) {
      await onFilter(startDate, endDate);
    } else {
      // 默認篩選邏輯
      if (startDate && endDate) {
        const filtered = data.filter(record => {
          const recordDate = new Date(record.date || record.time || record.startTime);
          const start = new Date(startDate);
          const end = new Date(endDate);
          return recordDate >= start && recordDate <= end;
        });
        setFilteredData(filtered);
      } else {
        setFilteredData(data);
      }
    }
  };

  const handleClear = async () => {
    const resetStart = initialStartDate ?? '';
    const resetEnd = initialEndDate ?? '';

    setStartDate(resetStart);
    setEndDate(resetEnd);

    if (onClear) {
      await onClear();
      return;
    }

    setFilteredData(data);
  };

  return (
    <Box>
      <DateFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFilter={handleFilter}
        onClear={handleClear}
        title={filterTitle}
        loading={loading}
      />

      <RecordsTable
        title={title}
        columns={columns}
        data={filteredData}
        loading={loading}
        error={error || undefined}
        onExport={onExport}
        onRefresh={onRefresh}
      />
    </Box>
  );
}
