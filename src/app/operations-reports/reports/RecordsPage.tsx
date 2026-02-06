import React, { useEffect, useState } from 'react';
import DateFilter from './DateFilter';
import RecordsTable from './RecordsTable';
import { FilterField } from './types/filter';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Checkbox, ListItemText, OutlinedInput, Stack
} from '@mui/material';

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
  filterable?: boolean;
  filterConfig?: FilterField[];  // 每個欄位的篩選設定
  onAdvancedFilter?: (filters: Record<string, any>) => void;
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
  initialEndDate,
  filterable = false,
  filterConfig = [],
  onAdvancedFilter
}: RecordsPageProps) {
  const [startDate, setStartDate] = useState(initialStartDate ?? '');
  const [endDate, setEndDate] = useState(initialEndDate ?? '');
  const [filteredData, setFilteredData] = useState(data);
  const [openAdvFilter, setOpenAdvFilter] = useState(false);
  const [advFilters, setAdvFilters] = useState<Record<string, any>>({});

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

  const handleAdvFilter = () => {
    // 🔍 過濾掉空值欄位
    const cleanedFilters = Object.fromEntries(
      Object.entries(advFilters).filter(([_, v]) => {
        if (Array.isArray(v)) return v.length > 0; // 保留有選項的多選
        return v !== '' && v !== null && v !== undefined; // 過濾空值
      })
    );
    //若有充電樁欄位但未選擇，提示錯誤並中止
    const hasChargerField = filterConfig.some(f => f.id === 'charger');
    if (hasChargerField && (!advFilters['charger'] || advFilters['charger'].length === 0)) {
      alert('請選擇至少一個充電樁');
      return;
    }
    onAdvancedFilter?.(advFilters);
    setOpenAdvFilter(false);
  };

  const handleAdvFilterChange = (id: string, value: any) => {
    setAdvFilters(prev => ({ ...prev, [id]: value }));
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
        filterable={filterable}
        onAdvancedFilter={() => setOpenAdvFilter(true)}  // 新增
      />
      {/* 進階篩選 Modal */}
      <Dialog open={openAdvFilter} onClose={() => setOpenAdvFilter(false)} maxWidth="sm" fullWidth>
        <DialogTitle>進階篩選</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {filterConfig.map(field => {
              if (field.type === 'text') {
                // 自動判斷是否為數字欄位
                const isNumberField = /(以上|以下|金額|餘額|數量|次數)/.test(field.label);
                return (
                  <TextField
                    key={field.id}
                    label={field.label}
                    type={isNumberField ? 'number' : 'text'} // ✅ 自動切換輸入類型
                    value={advFilters[field.id] || ''}
                    onChange={e => handleAdvFilterChange(field.id, e.target.value)}
                    fullWidth
                    size="small"
                    inputProps={isNumberField ? { min: 0, step: 'any' } : undefined}
                  />
                );
              }
              if (field.type === 'select') {
                return (
                  <FormControl key={field.id} fullWidth size="small">
                    <InputLabel>{field.label}</InputLabel>
                    <Select
                      value={advFilters[field.id] || ''}
                      onChange={e =>
                        handleAdvFilterChange(field.id, e.target.value === '全部' ? '' : e.target.value)
                      }
                      label={field.label}
                      // ✅ 若值為空字串時顯示「全部」
                      renderValue={(selected) => selected === '' ? '全部' : selected}
                    >
                      {field.options?.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }
              if (field.type === 'multi-select') {
                const selectedValues = advFilters[field.id] || [];
                const allSelected = field.options?.length && selectedValues.length === field.options.length;
              
                const handleToggleAll = () => {
                  const newValue = allSelected ? [] : field.options || [];
                  handleAdvFilterChange(field.id, newValue);              
                  //全選/取消全選時立即觸發充電樁更新
                  if (field.id === 'meterNo') {
                    onAdvancedFilter?.({ ...advFilters, [field.id]: newValue });
                  }
                };
              
                const handleSelectChange = (value: string[]) => {
                  handleAdvFilterChange(field.id, value);              
                  //單選/多選時，如果是電表，也立即觸發
                  if (field.id === 'meterNo') {
                    onAdvancedFilter?.({ ...advFilters, [field.id]: value });
                  }
                };

                return (
                  <FormControl key={field.id} fullWidth size="small">
                    {/* <InputLabel>{field.label}</InputLabel> */}
                     <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 0.5 }}
                    >
                      <Box
                        component="label"
                        sx={{
                          fontSize: '0.9rem',
                          color: 'text.secondary',
                          fontWeight: 500,
                        }}
                      >
                        {field.label}
                      </Box>
              
                      <Button
                        onClick={handleToggleAll}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          padding: '2px 6px',
                          minWidth: 'unset',
                        }}
                      >
                        {allSelected ? '取消全選' : '全選'}
                      </Button>
                    </Stack>
                    <Select
                      multiple
                      value={advFilters[field.id] || []}                      
                      onChange={e => handleSelectChange(e.target.value)}
                      input={<OutlinedInput label={field.label} />}
                      renderValue={(selected) => (selected as string[]).join(', ')}
                    >
                      {field.options?.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          <Checkbox checked={(advFilters[field.id] || []).includes(opt)} />
                          <ListItemText primary={opt} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }
              if (field.type === 'range') {
                return (
                  <Stack direction="row" spacing={1} key={field.id}>
                    <TextField
                      label={`最小${field.label}`}
                      type="number"
                      size="small"
                      value={advFilters[field.minField!] || ''}
                      onChange={e => handleAdvFilterChange(field.minField!, e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label={`最大${field.label}`}
                      type="number"
                      size="small"
                      value={advFilters[field.maxField!] || ''}
                      onChange={e => handleAdvFilterChange(field.maxField!, e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                );
              }
              return null;
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdvFilter(false)}>取消</Button>
          <Button
            onClick={() => {
              setAdvFilters({});
              setOpenAdvFilter(false);
              //清除時立即觸發搜尋更新（重置結果）
              onAdvancedFilter?.({});
            }}
            color="inherit"
          >
            清除
          </Button>
          <Button onClick={handleAdvFilter} variant="contained">
            套用篩選
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
