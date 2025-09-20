'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface OperationLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

const OperationLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  
  // 篩選條件
  const [filters, setFilters] = useState({
    entityType: '',
    actionType: '',
    startDate: '',
    endDate: ''
  });

  const entityTypes = [
    { value: 'USER', label: '用戶' },
    { value: 'STATION', label: '充電站' },
    { value: 'METER', label: '電錶' },
    { value: 'GUN', label: '充電槍' },
    { value: 'TARIFF', label: '費率' },
    { value: 'WALLET', label: '錢包' },
    { value: 'RFID_CARD', label: 'RFID卡片' },
    { value: 'SYSTEM_CONFIG', label: '系統配置' }
  ];

  const actionTypes = [
    { value: 'CREATE', label: '創建' },
    { value: 'UPDATE', label: '更新' },
    { value: 'DELETE', label: '刪除' },
    { value: 'LOGIN', label: '登入' },
    { value: 'LOGOUT', label: '登出' },
    { value: 'EXPORT', label: '匯出' },
    { value: 'IMPORT', label: '匯入' }
  ];

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        ...filters
      });

      const response = await fetch(`/api/admin/operation-logs?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('獲取操作日誌失敗');
      }
      
      const data = await response.json();
      setLogs(data.data.logs);
      setTotal(data.data.pagination.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, rowsPerPage, filters]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const getStatusColor = (status: string) => {
    return status === 'SUCCESS' ? 'success' : 'error';
  };

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'error';
      case 'LOGIN': case 'LOGOUT': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        操作日誌管理
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 篩選器 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>篩選條件</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>實體類型</InputLabel>
                <Select
                  value={filters.entityType}
                  label="實體類型"
                  onChange={(e) => handleFilterChange('entityType', e.target.value)}
                >
                  <MenuItem value="">全部</MenuItem>
                  {entityTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>操作類型</InputLabel>
                <Select
                  value={filters.actionType}
                  label="操作類型"
                  onChange={(e) => handleFilterChange('actionType', e.target.value)}
                >
                  <MenuItem value="">全部</MenuItem>
                  {actionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="開始日期"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="結束日期"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 日誌表格 */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>時間</TableCell>
                <TableCell>操作員</TableCell>
                <TableCell>操作類型</TableCell>
                <TableCell>實體類型</TableCell>
                <TableCell>實體名稱</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>狀態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">載入中...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">暫無日誌記錄</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhTW })}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {log.user_name || log.user_email}
                        </Typography>
                        {log.user_name && (
                          <Typography variant="caption" color="text.secondary">
                            {log.user_email}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.action_type} 
                        color={getActionTypeColor(log.action_type) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell>{log.entity_name || log.entity_id || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, wordBreak: 'break-word' }}>
                        {log.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.status} 
                        color={getStatusColor(log.status)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="每頁顯示:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} 共 ${count !== -1 ? count : `超過 ${to}`} 條`
          }
        />
      </Paper>
    </Box>
  );
};

export default OperationLogsPage;
