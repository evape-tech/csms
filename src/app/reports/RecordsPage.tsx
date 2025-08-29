import React, { useState } from 'react';
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
  onFilter?: (startDate: string, endDate: string) => void;
  onExport?: () => void;
}

export default function RecordsPage({
  title,
  columns,
  data,
  filterTitle,
  onFilter,
  onExport
}: RecordsPageProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredData, setFilteredData] = useState(data);

  const handleFilter = () => {
    if (onFilter) {
      onFilter(startDate, endDate);
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

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
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
      />

      <RecordsTable
        title={title}
        columns={columns}
        data={filteredData}
        onExport={onExport}
      />
    </Box>
  );
}
