import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Paper, Button, TextField,
  InputAdornment, Chip, TablePagination, Typography, Stack
} from '@mui/material';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string;
  sortable?: boolean;
}

interface RecordsTableProps {
  title: string;
  columns: Column[];
  data: any[];
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  onExport?: () => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onAdvancedFilter?: () => void;
}

export default function RecordsTable({
  title,
  columns,
  data,
  searchable = true,
  filterable = true,
  exportable = true,
  onExport,
  loading = false,
  error,
  onRefresh,
  onAdvancedFilter
}: RecordsTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const dataset = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // 處理排序
  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 過濾和排序數據
  const filteredAndSortedData = useMemo(() => {
    let filtered = dataset;

    // 搜索過濾
    if (searchTerm) {
      filtered = dataset.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // 排序
    if (orderBy) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[orderBy];
        const bValue = b[orderBy];

        if (aValue < bValue) return order === 'asc' ? -1 : 1;
        if (aValue > bValue) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [dataset, searchTerm, orderBy, order]);

  // 分頁數據
  const paginatedData = useMemo(() => {
    return filteredAndSortedData.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredAndSortedData, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // 默認導出邏輯
      console.log('導出數據:', filteredAndSortedData);
    }
  };

  return (
    <Card>
      <CardContent>
        {/* 標題和操作按鈕 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">{title}</Typography>
          <Stack direction="row" spacing={1}>
            {onRefresh && (
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={onRefresh}
                size="small"
                disabled={loading}
              >
                重新整理
              </Button>
            )}
            {exportable && (
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                size="small"
                disabled={loading}
              >
                導出
              </Button>
            )}
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 搜索和過濾 */}
        {(searchable || filterable) && (
          <Box display="flex" gap={2} mb={2}>
            {searchable && (
              <TextField
                placeholder="搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
                sx={{ minWidth: 250 }}
              />
            )}
            {filterable && (
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                size="small"
                onClick={onAdvancedFilter || (() => {})}
              >
                進階篩選
              </Button>
            )}
          </Box>
        )}

        {/* 數據統計 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="body2" color="text.secondary">
            共 {filteredAndSortedData.length} 條記錄
          </Typography>
          {searchTerm && (
            <Chip
              label={`搜索結果: ${filteredAndSortedData.length} 條`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        {/* 表格 */}
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align || 'left'}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.sortable !== false ? (
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={orderBy === column.id ? order : 'asc'}
                        onClick={() => handleRequestSort(column.id)}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) => (
                  <TableRow hover key={row.id || index}>
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell key={column.id} align={column.align || 'left'}>
                          {column.format ? (
                            <span dangerouslySetInnerHTML={{ __html: column.format(value) }} />
                          ) : (
                            value
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : !loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      沒有找到相關記錄
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 分頁 */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredAndSortedData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每頁顯示:"
          labelDisplayedRows={({ from, to, count }) =>
            `第 ${from}-${to} 條，共 ${count} 條`
          }
        />
      </CardContent>
    </Card>
  );
}
