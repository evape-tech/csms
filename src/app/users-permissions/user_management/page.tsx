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
import AddIcon from '@mui/icons-material/Add';
import UserDialog from '@/components/dialog/UserDialog';
import ResetPasswordDialog from '@/components/dialog/ResetPasswordDialog';
import CardManagementDialog from '@/components/dialog/CardManagementDialog';
import { createUser } from '@/actions/userActions';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '啟用', value: 'ACTIVE' },
  { label: '暫停', value: 'SUSPENDED' },
  { label: '封鎖', value: 'BLOCKED' },
  { label: '待審核', value: 'PENDING' },
] as const;

export default function UserManagement() {
  const theme = useTheme();
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0); // 0 for administrators, 1 for users
  const [administrators, setAdministrators] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState<boolean>(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [cardManagementDialogOpen, setCardManagementDialogOpen] = useState<boolean>(false);
  const [cardManagementUser, setCardManagementUser] = useState<any>(null);
  
  // 從 API 獲取用戶數據
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
  
  // 初始化數據
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // 處理標籤頁切換
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // 處理新增用戶
  const handleAddUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  // 處理編輯用戶
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  // 處理關閉對話框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
  };

  // 處理提交用戶表單
  const handleSubmitUser = async (formData: FormData) => {
    setSubmitting(true);
    try {
      let result;
      if (editingUser) {
        // 編輯模式
        const { updateUser } = await import('../../../actions/userActions');
        result = await updateUser(editingUser.id, formData);
      } else {
        // 新增模式
        result = await createUser(formData);
      }
      
      if (result.success) {
        // 重新獲取用戶數據
        await fetchUsers();
        handleCloseDialog();
      } else {
        alert((editingUser ? '更新用戶失敗: ' : '創建用戶失敗: ') + result.error);
      }
    } catch (error) {
      console.error('提交用戶表單失敗:', error);
      alert((editingUser ? '更新用戶失敗: ' : '創建用戶失敗: ') + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setSubmitting(false);
    }
  };

  // 處理重設密碼
  const handleResetPassword = (user: any) => {
    setResetPasswordUser(user);
    setResetPasswordDialogOpen(true);
  };

  // 處理關閉重設密碼對話框
  const handleCloseResetPasswordDialog = () => {
    setResetPasswordDialogOpen(false);
    setResetPasswordUser(null);
  };

  // 處理提交重設密碼表單
  const handleSubmitResetPassword = async (formData: FormData) => {
    try {
      const headers = {
        'X-API-Key': 'admin-secret-key',
        'Content-Type': 'application/json',
      };
      
      const payload = {
        userId: String(formData.get('userId') ?? ''),
        newPassword: String(formData.get('password') ?? '')
      };

      // 詳細記錄 request
      console.debug('[UI] POST /api/users/reset-password', { headers, payload });

      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const text = await response.text().catch(() => null);
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }

      // 記錄回應內容以便排查
      console.debug('[UI] /api/users/reset-password response', { status: response.status, body: json });

      if (!response.ok) {
        const errMsg = (json && (json.error || json.message)) ? (json.error || json.message) : `Status ${response.status}`;
        throw new Error(`重設密碼失敗: ${errMsg}`);
      }

      alert('密碼重設成功');
      handleCloseResetPasswordDialog();
    } catch (error) {
      console.error('重設密碼失敗:', error);
      // 顯示更友善錯誤
      alert(error instanceof Error ? error.message : '重設密碼失敗');
      throw error;
    }
  };

  // 處理卡片管理
  const handleCardManagement = (user: any) => {
    setCardManagementUser(user);
    setCardManagementDialogOpen(true);
  };

  // 處理關閉卡片管理對話框
  const handleCloseCardManagementDialog = () => {
    setCardManagementDialogOpen(false);
    setCardManagementUser(null);
  };

  // 獲取當前標籤頁的數據
  const currentData = activeTab === 0 ? administrators : users;
  
  // 計算統計數據
  const summary = {
    total: currentData.length,
    active: currentData.filter((user: any) => user.account_status === 'ACTIVE').length,
    suspended: currentData.filter((user: any) => user.account_status === 'SUSPENDED').length,
    blocked: currentData.filter((user: any) => user.account_status === 'BLOCKED').length,
    pending: currentData.filter((user: any) => user.account_status === 'PENDING').length,
    emailVerified: currentData.filter((user: any) => user.email_verified === true).length,
  };

  // 過濾數據
  const filteredRows = currentData.filter((row: any) => {
    const matchesKeyword = !keyword || 
      row.first_name?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.last_name?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.email?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.phone?.toLowerCase().includes(keyword.toLowerCase());
    
    const matchesStatus = !status || row.account_status === status;
    
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
          用戶資料管理
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
            搜尋與篩選
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddUser}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              px: 3,
              py: 1,
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4],
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            新增{activeTab === 0 ? '管理者' : '使用者'}
          </Button>
        </Box>
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={3} 
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <TextField
            label="關鍵字搜尋"
            placeholder="輸入姓名、Email或電話"
            size="medium"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ 
              minWidth: { xs: '100%', md: 300 },
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
            onChange={(e) => setStatus(e.target.value)}
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
                  {opt.value === 'ACTIVE' && <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                  {opt.value === 'SUSPENDED' && <CancelIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />}
                  {opt.value === 'BLOCKED' && <CancelIcon sx={{ color: 'error.main', fontSize: '1rem' }} />}
                  {opt.value === 'PENDING' && <CancelIcon sx={{ color: 'info.main', fontSize: '1rem' }} />}
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
          '& > *': { flex: '1 1 280px', minWidth: 250 }
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
                    啟用帳戶
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
                  <CancelIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    暫停/封鎖帳戶
                  </Typography>
                  <Typography variant="h4" sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.warning.main,
                    lineHeight: 1
                  }}>
                    {summary.suspended + summary.blocked}
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
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Email已驗證
                  </Typography>
                  <Typography variant="h4" sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.info.main,
                    lineHeight: 1
                  }}>
                    {summary.emailVerified}
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
                  Email
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  電話
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  權限
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  帳戶狀態
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  Email驗證
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  最後登入
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
                        {(row.first_name || row.email || '').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {`${row.first_name || ''} ${row.last_name || ''}`.trim() || '未設定'}
                        </Typography>
                        {row.first_name && row.last_name && (
                          <Typography variant="caption" color="text.secondary">
                            {row.first_name} {row.last_name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {row.email || '未設定'}
                      </Typography>
                      {row.email_verified && (
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1rem' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2">
                      {row.phone || '未設定'}
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
                      label={
                        row.account_status === 'ACTIVE' ? '啟用' :
                        row.account_status === 'SUSPENDED' ? '暫停' :
                        row.account_status === 'BLOCKED' ? '封鎖' :
                        row.account_status === 'PENDING' ? '待審核' : '未知'
                      } 
                      size="small"
                      color={
                        row.account_status === 'ACTIVE' ? 'success' :
                        row.account_status === 'SUSPENDED' ? 'warning' :
                        row.account_status === 'BLOCKED' ? 'error' :
                        row.account_status === 'PENDING' ? 'info' : 'default'
                      }
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Chip 
                      label={row.email_verified ? '已驗證' : '未驗證'} 
                      size="small"
                      color={row.email_verified ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {row.last_login_at ? new Date(row.last_login_at).toLocaleDateString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '從未登入'}
                    </Typography>
                    {row.login_count > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        登入次數: {row.login_count}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Stack direction="row" spacing={1}>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => handleEditUser(row)}
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
                        color="warning"
                        onClick={() => handleResetPassword(row)}
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
                      {/* 只有一般用戶才顯示卡片管理按鈕 */}
                      {row.role === 'user' && (
                        <Button 
                          size="small" 
                          variant="outlined" 
                          color="success"
                          onClick={() => handleCardManagement(row)}
                          sx={{ 
                            minWidth: 'auto',
                            px: 2,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 500
                          }}
                        >
                          卡片管理
                        </Button>
                      )}
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

      {/* 用戶對話框 */}
      <UserDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitUser}
        editingUser={editingUser}
      />

      {/* 重設密碼對話框 */}
      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onClose={handleCloseResetPasswordDialog}
        onSubmit={handleSubmitResetPassword}
        user={resetPasswordUser}
      />

      {/* 卡片管理對話框 */}
      <CardManagementDialog
        open={cardManagementDialogOpen}
        onClose={handleCloseCardManagementDialog}
        user={cardManagementUser}
      />
    </Container>
  );
}
