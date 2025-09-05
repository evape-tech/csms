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
  Tabs,
  Tab,
  Chip,
  Avatar,
  InputAdornment,
  Container,
  useTheme,
  alpha,
  Alert,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TableChartIcon from '@mui/icons-material/TableChart';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '啟用', value: 'active' },
  { label: '停用', value: 'disabled' },
];

export default function UserManagement() {
  const theme = useTheme();
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 for administrators, 1 for users
  const [administrators, setAdministrators] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 從 API 獲取用戶數據
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError('');
      
      try {
        // API 請求頭 - 包含 API 密鑰
        const headers = {
          'X-API-Key': 'admin-secret-key' // 在生產環境中，應該從環境變量或安全存儲中獲取
        };
        
        // 獲取管理員
        const adminResponse = await fetch('/api/users?role=admin', { headers });
        if (!adminResponse.ok) {
          throw new Error(`獲取管理員數據失敗: ${adminResponse.statusText}`);
        }
        const adminData = await adminResponse.json();
        setAdministrators(adminData.data || []);
        
        // 獲取一般用戶
        const userResponse = await fetch('/api/users?role=user', { headers });
        if (!userResponse.ok) {
          throw new Error(`獲取用戶數據失敗: ${userResponse.statusText}`);
        }
        const userData = await userResponse.json();
        setUsers(userData.data || []);
        
      } catch (err) {
        console.error('獲取用戶數據失敗:', err);
        setError('獲取用戶數據時發生錯誤，請稍後再試');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);
  
  // 處理標籤頁切換
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // 獲取當前標籤頁的數據
  const currentData = activeTab === 0 ? administrators : users;
  
  // 計算統計數據
  const summary = {
    total: currentData.length,
    active: currentData.filter((user: any) => user.status === 'active').length,
    disabled: currentData.filter((user: any) => user.status === 'disabled').length,
  };

  // 過濾數據
  const filteredRows = currentData.filter((row: any) => {
    const matchesKeyword = !keyword || 
      row.name?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.account?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.email?.toLowerCase().includes(keyword.toLowerCase());
    
    const matchesStatus = !status || row.status === status;
    
    return matchesKeyword && matchesStatus;
  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
          <AdminPanelSettingsIcon sx={{ fontSize: '2rem' }} />
          用戶管理系統
        </Typography>
        <Typography variant="body1" color="text.secondary">
          管理系統中的所有用戶帳戶和權限設定
        </Typography>
      </Box>

      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* 標籤頁切換 */}
      <Paper 
        elevation={0} 
        sx={{ 
          mb: 4, 
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          sx={{ 
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            '& .MuiTab-root': {
              py: 2,
              px: 4,
              fontWeight: 600,
              fontSize: '0.95rem',
              minHeight: 64,
              textTransform: 'none',
              '&.Mui-selected': {
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
              }
            }
          }}
        >
          <Tab 
            icon={<AdminPanelSettingsIcon />} 
            iconPosition="start"
            label={`管理者 (${administrators.length})`} 
          />
          <Tab 
            icon={<PersonIcon />} 
            iconPosition="start"
            label={`使用者 (${users.length})`} 
          />
        </Tabs>
      </Paper>      {/* 查詢/篩選區 */}
      <Paper 
        elevation={1} 
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
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={3} 
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <TextField
            label="關鍵字搜尋"
            placeholder="輸入姓名、帳號或Email"
            size="medium"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            sx={{ 
              minWidth: { xs: '100%', md: 280 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: theme.palette.background.default
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="狀態篩選"
            size="medium"
            value={status}
            onChange={e => setStatus(e.target.value)}
            sx={{ 
              minWidth: { xs: '100%', md: 160 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: theme.palette.background.default
              }
            }}
          >
            {statusOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {opt.value === 'active' && <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                  {opt.value === 'disabled' && <CancelIcon sx={{ color: 'error.main', fontSize: '1rem' }} />}
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <Button 
            variant="contained" 
            size="large"
            sx={{ 
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4],
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            查詢
          </Button>
        </Stack>
      </Paper>
      {/* 統計概覽 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.text.primary }}>
          統計概覽
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 3,
          '& > *': { flex: '1 1 300px', minWidth: 280 }
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
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {activeTab === 0 ? '管理者總數' : '使用者總數'}
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
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {activeTab === 0 ? '啟用管理者' : '啟用使用者'}
                  </Typography>
                  <Typography variant="h4" sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.success.main,
                    lineHeight: 1
                  }}>
                    {summary.active}
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
                  <CancelIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {activeTab === 0 ? '停用管理者' : '停用使用者'}
                  </Typography>
                  <Typography variant="h4" sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.error.main,
                    lineHeight: 1
                  }}>
                    {summary.disabled}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
      {/* 用戶列表表格 */}
      <Paper 
        elevation={2} 
        sx={{ 
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          position: 'relative',
          minHeight: '300px'
        }}
      >
        {/* 加載指示器 */}
        {loading && (
          <Box 
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha('#fff', 0.8),
              zIndex: 10
            }}
          >
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="body1">載入用戶資料中...</Typography>
          </Box>
        )}
        <Box sx={{ 
          p: 3, 
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.02)
        }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            color: theme.palette.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <TableChartIcon sx={{ color: theme.palette.primary.main }} />
            {activeTab === 0 ? '管理者列表' : '使用者列表'}
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.8) }}>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  姓名
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  帳號
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  Email
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  電話
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  權限
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  狀態
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  註冊日期
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row: any) => (
                <TableRow 
                  key={row.id}
                  sx={{ 
                    '&:hover': { 
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      transition: 'background-color 0.2s ease-in-out'
                    }
                  }}
                >
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                        {(row.name || '').charAt(0)}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.name || ''}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {row.account}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {row.email}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2">
                      {row.phone}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Chip 
                      label={activeTab === 0 ? '管理員' : '一般用戶'} 
                      size="small"
                      color={activeTab === 0 ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Chip 
                      label={row.status === 'active' ? '啟用' : '停用'} 
                      size="small"
                      color={row.status === 'active' ? 'success' : 'error'}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {row.createdAt || ''}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Stack direction="row" spacing={1}>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        sx={{ 
                          minWidth: 'auto',
                          px: 2,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        編輯
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        color={row.status === 'active' ? 'warning' : 'success'}
                        sx={{ 
                          minWidth: 'auto',
                          px: 2,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        {row.status === 'active' ? '停用' : '啟用'}
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        color="info"
                        sx={{ 
                          minWidth: 'auto',
                          px: 2,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500
                        }}
                      >
                        重設密碼
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* 表格分頁 */}
        <Box sx={{ 
          p: 2, 
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.default, 0.5)
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              顯示 {filteredRows.length} 筆資料
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button 
                size="small" 
                variant="outlined" 
                disabled
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                上一頁
              </Button>
              <Button 
                size="small" 
                variant="contained" 
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                1
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                下一頁
              </Button>
            </Stack>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
