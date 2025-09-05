"use client";
import React, { useState } from 'react';
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
  Switch,
  Container,
  Chip,
  Avatar,
  InputAdornment,
  useTheme,
  alpha,
  Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PaymentIcon from '@mui/icons-material/Payment';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TableChartIcon from '@mui/icons-material/TableChart';

const paymentMethods = [
  { id: 1, name: '信用卡', enabled: true },
  { id: 2, name: 'Line Pay', enabled: true },
  { id: 3, name: 'Apple Pay', enabled: false },
  { id: 4, name: '悠遊卡', enabled: true },
  { id: 5, name: 'RFID', enabled: true },
];
const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '成功', value: 'success' },
  { label: '失敗', value: 'fail' },
  { label: '退款', value: 'refund' },
];
const methodOptions = [
  { label: '全部方式', value: '' },
  ...paymentMethods.map(m => ({ label: m.name, value: m.name }))
];
const paymentRows = [
  { id: 1, user: '陳先生', amount: 120, method: '信用卡', status: 'success', time: '2024-06-01 10:20', order: 'ORD001' },
  { id: 2, user: '李小姐', amount: 80, method: 'Line Pay', status: 'fail', time: '2024-06-01 11:10', order: 'ORD002' },
  { id: 3, user: '張大明', amount: 60, method: '悠遊卡', status: 'success', time: '2024-06-02 09:30', order: 'ORD003' },
];

export default function PaymentManagement() {
  const theme = useTheme();
  const [methods, setMethods] = useState(paymentMethods);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [keyword, setKeyword] = useState('');

  // 計算統計數據
  const totalPayments = paymentRows.length;
  const successfulPayments = paymentRows.filter(row => row.status === 'success').length;
  const failedPayments = paymentRows.filter(row => row.status === 'fail').length;
  const totalAmount = paymentRows.reduce((sum, row) => sum + row.amount, 0);

  // 過濾數據
  const filteredRows = paymentRows.filter((row) => {
    const matchesKeyword = !keyword ||
      row.user?.toLowerCase().includes(keyword.toLowerCase()) ||
      row.order?.toLowerCase().includes(keyword.toLowerCase());

    const matchesMethod = !method || row.method === method;
    const matchesStatus = !status || row.status === status;

    return matchesKeyword && matchesMethod && matchesStatus;
  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
          <PaymentIcon sx={{ fontSize: '2rem' }} />
          支付管理系統
        </Typography>
        <Typography variant="body1" color="text.secondary">
          管理支付方式和查看支付記錄
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
                  <ReceiptIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    總支付金額
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1
                  }}>
                    ${totalAmount}
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
                    成功支付
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.success.main,
                    lineHeight: 1
                  }}>
                    {successfulPayments}
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
                    失敗支付
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.error.main,
                    lineHeight: 1
                  }}>
                    {failedPayments}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
      {/* 支付方式管理區域 */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
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
            <CreditCardIcon sx={{ color: theme.palette.primary.main }} />
            支付方式管理
          </Typography>
        </Box>
        <Box sx={{ p: 3 }}>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            '& > *': { flex: '1 1 280px', minWidth: 250 }
          }}>
            {methods.map(m => (
              <Card
                key={m.id}
                elevation={1}
                sx={{
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    elevation: 3,
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{
                        bgcolor: m.enabled ? theme.palette.primary.main : theme.palette.grey[400],
                        width: 40,
                        height: 40
                      }}>
                        {m.name === '信用卡' && <CreditCardIcon />}
                        {m.name === 'Line Pay' && <AccountBalanceWalletIcon />}
                        {m.name === 'Apple Pay' && <AccountBalanceWalletIcon />}
                        {m.name === '悠遊卡' && <AccountBalanceWalletIcon />}
                        {m.name === 'RFID' && <AccountBalanceWalletIcon />}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {m.name}
                        </Typography>
                        <Chip
                          label={m.enabled ? '啟用' : '停用'}
                          size="small"
                          color={m.enabled ? 'success' : 'default'}
                          variant="filled"
                        />
                      </Box>
                    </Box>
                    <Switch
                      checked={m.enabled}
                      onChange={(_, checked) => setMethods(list => list.map(x => x.id === m.id ? { ...x, enabled: checked } : x))}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theme.palette.primary.main,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: theme.palette.primary.main,
                        },
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </Paper>
      {/* 支付記錄查詢篩選區 */}
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
            placeholder="輸入用戶名稱或訂單編號"
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
            label="支付方式"
            size="medium"
            value={method}
            onChange={e => setMethod(e.target.value)}
            sx={{
              minWidth: { xs: '100%', md: 160 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: theme.palette.background.default
              }
            }}
          >
            {methodOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {opt.value === '信用卡' && <CreditCardIcon sx={{ color: 'primary.main', fontSize: '1rem' }} />}
                  {opt.value === 'Line Pay' && <AccountBalanceWalletIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                  {opt.value === 'Apple Pay' && <AccountBalanceWalletIcon sx={{ color: 'info.main', fontSize: '1rem' }} />}
                  {opt.value === '悠遊卡' && <AccountBalanceWalletIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />}
                  {opt.value === 'RFID' && <AccountBalanceWalletIcon sx={{ color: 'secondary.main', fontSize: '1rem' }} />}
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="狀態"
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
                  {opt.value === 'success' && <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                  {opt.value === 'fail' && <CancelIcon sx={{ color: 'error.main', fontSize: '1rem' }} />}
                  {opt.value === 'refund' && <AccountBalanceWalletIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />}
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
      {/* 支付記錄表格 */}
      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
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
            支付記錄 ({filteredRows.length} 筆)
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.8) }}>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  用戶
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  金額
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  支付方式
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  狀態
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  時間
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  訂單編號
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary, py: 2 }}>
                  操作
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map(row => (
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
                        {row.user.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.user}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                      ${row.amount}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {row.method === '信用卡' && <CreditCardIcon sx={{ color: 'primary.main', fontSize: '1rem' }} />}
                      {row.method === 'Line Pay' && <AccountBalanceWalletIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                      {row.method === 'Apple Pay' && <AccountBalanceWalletIcon sx={{ color: 'info.main', fontSize: '1rem' }} />}
                      {row.method === '悠遊卡' && <AccountBalanceWalletIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />}
                      {row.method === 'RFID' && <AccountBalanceWalletIcon sx={{ color: 'secondary.main', fontSize: '1rem' }} />}
                      <Typography variant="body2">
                        {row.method}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Chip
                      label={row.status === 'success' ? '成功' : row.status === 'fail' ? '失敗' : '退款'}
                      size="small"
                      color={row.status === 'success' ? 'success' : row.status === 'fail' ? 'error' : 'warning'}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {row.time}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {row.order}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
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
                      詳情
                    </Button>
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
              顯示 {filteredRows.length} 筆資料，共 {paymentRows.length} 筆
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
