import React from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Box,
  Typography,
  Chip
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onFilter: () => void;
  onClear: () => void;
  title?: string;
  loading?: boolean;
}

export default function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onFilter,
  onClear,
  title = "日期範圍篩選",
  loading = false
}: DateFilterProps) {
  const hasActiveFilter = startDate || endDate;

  const getQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  const handleQuickFilter = (days: number) => {
    const range = getQuickDateRange(days);
    onStartDateChange(range.start);
    onEndDateChange(range.end);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon color="primary" />
            {title}
          </Typography>
          {hasActiveFilter && (
            <Chip
              label="已應用篩選"
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* 快速日期選擇 */}
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" mb={1}>
            快速選擇:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter(7)}
              disabled={loading}
            >
              最近7天
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter(30)}
              disabled={loading}
            >
              最近30天
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleQuickFilter(90)}
              disabled={loading}
            >
              最近90天
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const startDate = new Date(currentYear, currentMonth, 1);
                const endDate = new Date(currentYear, currentMonth + 1, 0);

                onStartDateChange(startDate.toISOString().split('T')[0]);
                onEndDateChange(endDate.toISOString().split('T')[0]);
              }}
              disabled={loading}
            >
              本月
            </Button>
          </Stack>
        </Box>

        {/* 自定義日期選擇 */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <TextField
            label="開始日期"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 160 }}
            fullWidth
          />
          <TextField
            label="結束日期"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 160 }}
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ minWidth: 'fit-content' }}>
            <Button
              variant="contained"
              onClick={onFilter}
              disabled={!startDate || !endDate || loading}
            >
              應用篩選
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={onClear}
              disabled={!hasActiveFilter || loading}
            >
              清除
            </Button>
          </Stack>
        </Stack>

        {/* 當前篩選顯示 */}
        {hasActiveFilter && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary" mb={1}>
              當前篩選:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {startDate && (
                <Chip
                  label={`開始: ${startDate}`}
                  size="small"
                  variant="outlined"
                  onDelete={() => onStartDateChange('')}
                />
              )}
              {endDate && (
                <Chip
                  label={`結束: ${endDate}`}
                  size="small"
                  variant="outlined"
                  onDelete={() => onEndDateChange('')}
                />
              )}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
