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
  Switch,
  Container,
  Chip,
  Avatar,
  InputAdornment,
  useTheme,
  alpha,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  togglePaymentMethodStatus,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod
} from '../../actions/paymentActions';
import SearchIcon from '@mui/icons-material/Search';
import PaymentIcon from '@mui/icons-material/Payment';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TableChartIcon from '@mui/icons-material/TableChart';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentMethodDialog from '../../components/dialog/PaymentMethodDialog';
import PaymentDetailDialog from '../../components/dialog/PaymentDetailDialog';

// 定義類型
interface PaymentMethod {
  id: number;
  name: string;
  status: number;
  config?: any;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRecord {
  id: string;
  transactionId: string;
  userId: string;
  idTag: string;
  userName?: string;
  amount: number;
  energyConsumed: number;
  paymentMethod: string;
  status: string;
  startTime: string;
  endTime: string;
  chargingDuration: number;
  cpid: string;
  cpsn: string;
  connectorId: number;
  invoiceNumber: string;
  createdAt: string;
}

const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (value && typeof (value as any).toNumber === 'function') {
    try {
      const parsed = (value as any).toNumber();
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch (error) {
      console.warn('[PaymentManagement] Failed to parse numeric value from Prisma Decimal:', error);
    }
  }

  return fallback;
};

const toIsoString = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
};

type UiPaymentStatus = 'success' | 'fail' | 'refund' | 'pending';

const mapBillingStatusToUiStatus = (status: string | null | undefined): UiPaymentStatus => {
  switch (status) {
    case 'PAID':
    case 'INVOICED':
    case 'COMPLETED':
      return 'success';
    case 'ERROR':
    case 'FAILED':
      return 'fail';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'refund';
    case 'PENDING':
    case 'CALCULATED':
    default:
      return 'pending';
  }
};

const transformBillingRecord = (record: any): PaymentRecord => {
  const amount = safeNumber(record.total_amount ?? record.amount ?? record.energy_fee, 0);
  const energyConsumed = safeNumber(record.energy_consumed ?? record.energyConsumed, 0);
  const chargingDuration = safeNumber(record.charging_duration ?? record.chargingDuration, 0);
  const connectorId = safeNumber(record.connector_id ?? record.connectorId, 0);
  const user = record.users ?? record.user ?? null;
  const firstName = user?.first_name ?? user?.firstName ?? '';
  const lastName = user?.last_name ?? user?.lastName ?? '';
  const userDisplayName = (firstName + lastName)?.trim() || user?.full_name || user?.fullName || user?.name || '';

  return {
    id: String(record.id ?? record.transaction_id ?? record.billing_record_id ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    transactionId: String(record.transaction_id ?? record.transactionId ?? ''),
    userId: String(record.user_id ?? record.userId ?? ''),
    idTag: String(record.id_tag ?? record.idTag ?? ''),
    userName: userDisplayName || undefined,
    amount,
    energyConsumed,
    paymentMethod: String(record.payment_method ?? record.paymentMethod ?? '錢包扣款'),
    status: mapBillingStatusToUiStatus(record.status),
    startTime: toIsoString(record.start_time ?? record.startTime),
    endTime: toIsoString(record.end_time ?? record.endTime),
    chargingDuration,
    cpid: String(record.cpid ?? ''),
    cpsn: String(record.cpsn ?? ''),
    connectorId,
    invoiceNumber: String(record.invoice_number ?? record.invoiceNumber ?? ''),
    createdAt: toIsoString(record.createdAt ?? record.created_at ?? record.start_time)
  };
};

const statusChipMap: Record<UiPaymentStatus, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
  success: { label: '成功', color: 'success' },
  fail: { label: '失敗', color: 'error' },
  refund: { label: '退款', color: 'warning' },
  pending: { label: '處理中', color: 'info' }
};

interface FormData {
  name: string;
  code: string;
  status: number;
  config: any;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '成功', value: 'success' },
  { label: '失敗', value: 'fail' },
  { label: '退款', value: 'refund' },
  { label: '處理中', value: 'pending' },
];

export default function PaymentManagement() {
  const theme = useTheme();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PaymentMethod | null>(null);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    status: 1,
    config: {}
  });

  // 獲取支付方式數據
  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/billing/channels');
      const result = await response.json();

      if (result.success) {
        setPaymentMethods(result.data);
        setError(null);
      } else {
        setError(result.error || '獲取支付方式失敗');
      }
    } catch (err) {
      setError('網絡錯誤，請稍後重試');
      console.error('Error fetching payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  // 獲取支付記錄數據
  const fetchPaymentRecords = async (page = 1, limit = 10) => {
    try {
      setRecordsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
        ...(keyword && { keyword })
      });

      const response = await fetch(`/api/billing/records?${params}`);
      const result = await response.json();

      if (result.success) {
        const normalizedRecords = Array.isArray(result.data)
          ? result.data.map(transformBillingRecord)
          : [];

        const nextPagination = {
          page: result.pagination?.page ?? page,
          limit: result.pagination?.limit ?? limit,
          total: result.pagination?.total ?? normalizedRecords.length,
          totalPages: result.pagination?.totalPages ?? result.pagination?.pages ?? Math.ceil((result.pagination?.total ?? normalizedRecords.length) / (result.pagination?.limit ?? limit))
        };

        setPaymentRecords(normalizedRecords);
        setPagination(nextPagination);
        setCurrentPage(nextPagination.page);
      } else {
        console.error('Error fetching payment records:', result.error);
        setPaymentRecords([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
      }
    } catch (err) {
      console.error('Error fetching payment records:', err);
      setPaymentRecords([]);
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
    fetchPaymentRecords();
  }, []);

  // 處理支付方式狀態切換
  const handleToggleStatus = async (channel: PaymentMethod) => {
    const result = await togglePaymentMethodStatus(channel.id);

    if (result.success && result.data) {
      setPaymentMethods(prev =>
        prev.map(m => m.id === channel.id ? {
          ...result.data!,
          createdAt: result.data!.createdAt.toISOString(),
          updatedAt: result.data!.updatedAt.toISOString()
        } : m)
      );
      setSnackbar({
        open: true,
        message: '支付方式狀態已更新',
        severity: 'success'
      });
    } else {
      setSnackbar({
        open: true,
        message: result.error || '更新失敗',
        severity: 'error'
      });
    }
  };

  // 處理新增/編輯支付方式
  const handleSaveChannel = async (formData: FormData) => {
    const isEditing = !!editingChannel;

    const result = isEditing
      ? await updatePaymentMethod(editingChannel.id, formData)
      : await createPaymentMethod(formData);

    if (result.success && result.data) {
      const formattedData = {
        ...result.data,
        createdAt: result.data.createdAt.toISOString(),
        updatedAt: result.data.updatedAt.toISOString()
      };

      if (isEditing) {
        setPaymentMethods(prev =>
          prev.map(m => m.id === editingChannel.id ? formattedData : m)
        );
      } else {
        setPaymentMethods(prev => [formattedData, ...prev]);
      }
      setOpenDialog(false);
      setEditingChannel(null);
      setFormData({ name: '', code: '', status: 1, config: {} });
      setSnackbar({
        open: true,
        message: isEditing ? '支付方式已更新' : '支付方式已新增',
        severity: 'success'
      });
    } else {
      setSnackbar({
        open: true,
        message: result.error || '操作失敗',
        severity: 'error'
      });
    }
  };

  // 處理刪除支付方式
  const handleDeleteChannel = async (channel: PaymentMethod) => {
    if (!confirm(`確定要刪除支付方式 "${channel.name}" 嗎？`)) {
      return;
    }

    const result = await deletePaymentMethod(channel.id);

    if (result.success) {
      setPaymentMethods(prev => prev.filter(m => m.id !== channel.id));
      setSnackbar({
        open: true,
        message: '支付方式已刪除',
        severity: 'success'
      });
    } else {
      setSnackbar({
        open: true,
        message: result.error || '刪除失敗',
        severity: 'error'
      });
    }
  };

  // 打開新增對話框
  const handleOpenAddDialog = () => {
    setEditingChannel(null);
    setFormData({ name: '', code: '', status: 1, config: {} });
    setOpenDialog(true);
  };

  // 打開編輯對話框
  const handleOpenEditDialog = (channel: PaymentMethod) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      code: '',
      status: channel.status,
      config: channel.config || {}
    });
    setOpenDialog(true);
  };

  // 處理查詢
  const handleSearch = () => {
    fetchPaymentRecords(1, pagination.limit);
  };

  // 處理分頁
  const handlePageChange = (page: number) => {
    fetchPaymentRecords(page, pagination.limit);
  };

  // 處理表單提交
  const handleFormSubmit = async (formData: FormData) => {
    await handleSaveChannel(formData);
  };

  // 處理查看詳情
  const handleViewDetail = (record: PaymentRecord) => {
    setSelectedRecord(record);
    setOpenDetailDialog(true);
  };

  // 關閉詳情對話框
  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedRecord(null);
  };

  // 計算統計數據
  const totalPayments = paymentRecords.length;
  const successfulPayments = paymentRecords.filter((record: PaymentRecord) => record.status === 'success').length;
  const failedPayments = paymentRecords.filter((record: PaymentRecord) => record.status === 'fail').length;
  const totalAmount = paymentRecords.reduce((sum: number, record: PaymentRecord) => sum + record.amount, 0);

  // 過濾數據（前端過濾，因為數據已經從後端獲取）
  const filteredRows = paymentRecords.filter((record: PaymentRecord) => {
    const matchesKeyword = !keyword ||
      record.userId?.toLowerCase().includes(keyword.toLowerCase()) ||
      record.userName?.toLowerCase().includes(keyword.toLowerCase()) ||
      record.transactionId?.toLowerCase().includes(keyword.toLowerCase());

    const matchesStatus = !status || record.status === status;

    return matchesKeyword && matchesStatus;
  });

  const formatCurrency = (value: number) => safeNumber(value).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formatNumber = (value: number, fractionDigits = 2) => safeNumber(value).toLocaleString('zh-TW', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
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
          儲值與支付管理系統
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
                    ${formatCurrency(totalAmount)}
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
      {/* 儲值與支付方式管理區域 */}
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
          bgcolor: alpha(theme.palette.primary.main, 0.02),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <CreditCardIcon sx={{ color: theme.palette.primary.main }} />
            儲值方式管理
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            新增儲值方式
          </Button>
        </Box>
        <Box sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: 3,
            }}>
              {paymentMethods.map(m => (
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
                          bgcolor: m.status === 1 ? theme.palette.primary.main : theme.palette.grey[400],
                          width: 40,
                          height: 40
                        }}>
                          <PaymentIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {m.name}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          onClick={() => handleOpenEditDialog(m)}
                          sx={{ minWidth: 'auto', p: 1 }}
                        >
                          <EditIcon fontSize="small" />
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDeleteChannel(m)}
                          sx={{ minWidth: 'auto', p: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </Button>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Chip
                        label={m.status === 1 ? '啟用' : '停用'}
                        size="small"
                        color={m.status === 1 ? 'success' : 'default'}
                        variant="filled"
                      />
                      <Switch
                        checked={m.status === 1}
                        onChange={() => handleToggleStatus(m)}
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
          )}
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
            onClick={handleSearch}
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
              {recordsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      載入中...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      沒有找到相關記錄
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row: PaymentRecord) => (
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
                          {row.userName?.charAt(0) || row.userId?.charAt(0) || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.userName || row.userId || '未知用戶'}
                          </Typography>
                          {row.transactionId && (
                            <Typography variant="caption" color="text.secondary">
                              {row.transactionId}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                        ${formatCurrency(row.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatNumber(row.energyConsumed)} kWh
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.paymentMethod === '信用卡' && <CreditCardIcon sx={{ color: 'primary.main', fontSize: '1rem' }} />}
                        {row.paymentMethod === 'Line Pay' && <AccountBalanceWalletIcon sx={{ color: 'success.main', fontSize: '1rem' }} />}
                        {row.paymentMethod === 'Apple Pay' && <AccountBalanceWalletIcon sx={{ color: 'info.main', fontSize: '1rem' }} />}
                        {row.paymentMethod === '悠遊卡' && <AccountBalanceWalletIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />}
                        {row.paymentMethod === 'RFID' && <AccountBalanceWalletIcon sx={{ color: 'secondary.main', fontSize: '1rem' }} />}
                        <Typography variant="body2">
                          {row.paymentMethod}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      {(() => {
                        const chipConfig = statusChipMap[(row.status as UiPaymentStatus)] ?? statusChipMap.pending;
                        return (
                          <Chip
                            label={chipConfig.label}
                            size="small"
                            color={chipConfig.color}
                            variant="filled"
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {row.startTime ? new Date(row.startTime).toLocaleString('zh-TW') : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        持續 {Math.max(0, Math.round(row.chargingDuration ?? 0))} 分鐘
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {row.invoiceNumber || row.transactionId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.cpid}-{row.connectorId}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleViewDetail(row)}
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
                ))
              )}
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
              顯示 {filteredRows.length} 筆資料，共 {pagination.total} 筆
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                上一頁
              </Button>
              <Button
                size="small"
                variant="contained"
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                {currentPage}
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                下一頁
              </Button>
            </Stack>
          </Box>
        </Box>
      </Paper>

      {/* 新增/編輯支付方式對話框 */}
      <PaymentMethodDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onSubmit={handleFormSubmit}
        editingChannel={editingChannel}
      />

      {/* 訂單詳情對話框 */}
      <PaymentDetailDialog
        open={openDetailDialog}
        onClose={handleCloseDetailDialog}
        record={selectedRecord}
      />

      {/* Snackbar 提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
