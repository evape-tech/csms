"use client";
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box,
  Card,
  CardContent,
  Stack,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Container,
  Chip,
  Avatar,
  InputAdornment,
  useTheme,
  alpha,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TableChartIcon from '@mui/icons-material/TableChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import RouterIcon from '@mui/icons-material/Router';
import InfoIcon from '@mui/icons-material/Info';

const typeOptions = [
  { label: '全部類型', value: '' },
  { label: '登入', value: 'LOGIN' },
  { label: '登出', value: 'LOGOUT' },
  { label: '新增', value: 'CREATE' },
  { label: '更新', value: 'UPDATE' },
  { label: '刪除', value: 'DELETE' },
  { label: '匯出', value: 'EXPORT' },
  { label: '匯入', value: 'IMPORT' },
];
const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失敗', value: 'FAILED' },
];

// 實體類型選項
const entityTypeOptions = [
  { label: '全部實體', value: '' },
  { label: '用戶', value: 'USER' },
  { label: '充電站', value: 'STATION' },
  { label: '電表', value: 'METER' },
  { label: '費率', value: 'TARIFF' },
  { label: '交易', value: 'TRANSACTION' },
  { label: '系統設置', value: 'SYSTEM_CONFIG' },
];

// 定義日誌接口
interface OperationLog {
  id: number;
  user_id?: string;
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

// 定義統計概覽接口
interface LogSummary {
  total: number;
  abnormal: number;
  warning: number;
  login: number;
  logout: number;
}

export default function OperationLog() {
  const theme = useTheme();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [entityType, setEntityType] = useState('');
  
  // 添加狀態管理
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [summary, setSummary] = useState<LogSummary>({
    total: 0,
    abnormal: 0,
    warning: 0,
    login: 0,
    logout: 0
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  
  // 獲取操作日誌數據
  const fetchOperationLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 構建查詢參數
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (type) params.append('actionType', type);
      if (status) params.append('status', status);
      if (entityType) params.append('entityType', entityType);
      if (keyword) params.append('keyword', keyword);
      
      const response = await fetch(`/api/operation-logs?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('獲取操作日誌失敗');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data.logs);
        setTotal(data.data.pagination.total);
        setSummary(data.data.summary);
        setUsingMockData(data.usingMockData || false);
      }
    } catch (err: any) {
      setError(err.message || '獲取操作日誌失敗');
      console.error('獲取操作日誌錯誤:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 首次加載和篩選條件變化時獲取數據
  useEffect(() => {
    fetchOperationLogs();
  }, [page, limit, type, status, entityType]);
  
  // 處理查詢按鈕點擊
  const handleSearch = () => {
    setPage(1); // 重置到第一頁
    fetchOperationLogs();
  };
  
  // 格式化日誌數據以適應UI顯示
  const formatLogForDisplay = (log: OperationLog) => {
    return {
      id: log.id,
      code: `L${String(log.id).padStart(4, '0')}`,
      time: new Date(log.createdAt).toLocaleString('zh-TW'),
      user: log.user_name,
      ip: '系統記錄', // 由於API沒有返回IP，使用固定文字
      type: log.action_type.toLowerCase(),
      status: log.status.toLowerCase(),
      desc: log.description || '無描述'
    };
  };
  
  // 過濾數據
  const filteredRows = logs
    .map(formatLogForDisplay)
    .filter((row) => {
      const matchesKeyword = !keyword ||
        row.code?.toLowerCase().includes(keyword.toLowerCase()) ||
        row.user?.toLowerCase().includes(keyword.toLowerCase()) ||
        row.desc?.toLowerCase().includes(keyword.toLowerCase());
      
      return matchesKeyword;
    });

  return (
    <Container
      maxWidth={false}
      sx={{
        maxWidth: '1400px',
        px: { xs: 2, sm: 3, md: 4 },
        py: 4
      }}
    >
      {/* 頁面標題 */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            color: theme.palette.primary.main,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <SecurityIcon sx={{ fontSize: '2rem' }} />
          操作日誌管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          監控系統操作事件和用戶活動記錄
        </Typography>
      </Box>

      {/* 統計概覽 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.text.primary }}>
          統計概覽
        </Typography>
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          '& > *': { flex: '1 1 280px', minWidth: 240 }
        }}>
          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{
                  bgcolor: theme.palette.primary.main,
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <SecurityIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    總事件數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1
                  }}>
                    {summary.total}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.error.main, 0.05),
              border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{
                  bgcolor: theme.palette.error.main,
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <ErrorIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    異常事件
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.error.main,
                    lineHeight: 1
                  }}>
                    {summary.abnormal}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.warning.main, 0.05),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{
                  bgcolor: theme.palette.warning.main,
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    警告事件
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.warning.main,
                    lineHeight: 1
                  }}>
                    {summary.warning}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.success.main, 0.05),
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{
                  bgcolor: theme.palette.success.main,
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <LoginIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    登入事件
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.success.main,
                    lineHeight: 1
                  }}>
                    {summary.login}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.info.main, 0.05),
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                elevation: 4,
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{
                  bgcolor: theme.palette.info.main,
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <LogoutIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    登出事件
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.info.main,
                    lineHeight: 1
                  }}>
                    {summary.logout}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
      {/* 查詢/篩選區 */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.text.primary }}>
          搜尋與篩選
        </Typography>
        
        {usingMockData && (
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            borderRadius: 2, 
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            color: theme.palette.warning.main,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <WarningIcon fontSize="small" />
            <Typography variant="body2">
              資料庫未初始化，目前顯示模擬數據。實際操作日誌將在資料庫準備就緒後顯示。
            </Typography>
          </Box>
        )}
        
        {error && !usingMockData && (
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            borderRadius: 2, 
            bgcolor: alpha(theme.palette.error.main, 0.1),
            color: theme.palette.error.main,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <ErrorIcon fontSize="small" />
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}
        
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'center'
        }}>
          <TextField
            label="關鍵字搜尋"
            size="small"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋事件編號、用戶或描述..."
            sx={{
              minWidth: 250,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5)
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            label="事件類型"
            size="small"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5)
              }
            }}
          >
            {typeOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="實體類型"
            size="small"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5)
              }
            }}
          >
            {entityTypeOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="狀態篩選"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5)
              }
            }}
          >
            {statusOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="contained"
            size="medium"
            onClick={handleSearch}
            disabled={loading}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: theme.shadows[4],
              '&:hover': {
                boxShadow: theme.shadows[8],
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '查詢'}
          </Button>
        </Box>
      </Paper>

      {/* 安全日誌列表 */}
      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}
      >
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TableChartIcon sx={{ color: theme.palette.primary.main, fontSize: '1.5rem' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              操作日誌列表
            </Typography>
            <Chip
              label={`${filteredRows.length} 筆記錄`}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontWeight: 500
              }}
            />
          </Box>
          
          {/* 重新整理按鈕 */}
          <Button
            size="small"
            variant="outlined"
            onClick={fetchOperationLogs}
            disabled={loading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
            }}
          >
            重新整理
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              '& .MuiTableCell-head': {
                fontWeight: 600,
                color: theme.palette.text.primary,
                borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }
            }}>
              <TableRow>
                <TableCell>事件編號</TableCell>
                <TableCell>時間</TableCell>
                <TableCell>用戶</TableCell>
                <TableCell>操作類型</TableCell>
                <TableCell>實體類型</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>描述</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" display="block" color="text.secondary">
                      載入中...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    sx={{
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.02)
                      },
                      '& .MuiTableCell-root': {
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                      },
                      ...(row.status === 'failed') && {
                        bgcolor: alpha(theme.palette.warning.main, 0.02),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.warning.main, 0.05)
                        }
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                        {row.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                        <Typography variant="body2">{row.time}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                        <Typography variant="body2">{row.user}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          row.type === 'login' ? '登入' :
                          row.type === 'logout' ? '登出' :
                          row.type === 'create' ? '新增' :
                          row.type === 'update' ? '更新' :
                          row.type === 'delete' ? '刪除' :
                          row.type === 'export' ? '匯出' :
                          row.type === 'import' ? '匯入' : '操作'
                        }
                        size="small"
                        color={
                          row.type === 'login' ? 'success' :
                          row.type === 'logout' ? 'info' :
                          row.type === 'delete' ? 'error' :
                          row.type === 'update' ? 'warning' : 'default'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {logs.find(log => log.id === row.id)?.entity_type && (
                        <Chip
                          label={
                            logs.find(log => log.id === row.id)?.entity_type === 'USER' ? '用戶' :
                            logs.find(log => log.id === row.id)?.entity_type === 'STATION' ? '充電站' :
                            logs.find(log => log.id === row.id)?.entity_type === 'METER' ? '電表' :
                            logs.find(log => log.id === row.id)?.entity_type === 'TARIFF' ? '費率' :
                            logs.find(log => log.id === row.id)?.entity_type === 'TRANSACTION' ? '交易' :
                            logs.find(log => log.id === row.id)?.entity_type === 'SYSTEM_CONFIG' ? '系統配置' : '其他'
                          }
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          row.status === 'success' ? '成功' : '失敗'
                        }
                        size="small"
                        color={
                          row.status === 'success' ? 'success' : 'error'
                        }
                        variant={row.status === 'success' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.desc}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{
                      p: 6,
                      textAlign: 'center',
                      color: theme.palette.text.secondary
                    }}>
                      <SecurityIcon sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }} />
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        沒有找到符合條件的記錄
                      </Typography>
                      <Typography variant="body2">
                        請調整搜尋條件或檢查拼寫
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
