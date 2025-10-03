"use client";
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Grid,
  Paper,
  Chip,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

// 定義支付記錄接口
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

type UiPaymentStatus = 'success' | 'fail' | 'refund' | 'pending';

const statusChipMap: Record<UiPaymentStatus, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
  success: { label: '成功', color: 'success' },
  fail: { label: '失敗', color: 'error' },
  refund: { label: '退款', color: 'warning' },
  pending: { label: '處理中', color: 'info' }
};

// 安全數字轉換函數
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
      console.warn('[PaymentDetailDialog] Failed to parse numeric value:', error);
    }
  }

  return fallback;
};

// 格式化函數
const formatCurrency = (value: number) => safeNumber(value).toLocaleString('zh-TW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatNumber = (value: number, fractionDigits = 2) => safeNumber(value).toLocaleString('zh-TW', {
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits
});

interface PaymentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  record: PaymentRecord | null;
}

export default function PaymentDetailDialog({ open, onClose, record }: PaymentDetailDialogProps) {
  const theme = useTheme();

  if (!record) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.02)
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ReceiptIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            訂單詳情
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* 基本資訊 */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
              基本資訊
            </Typography>
            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">訂單編號</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {record.invoiceNumber || record.transactionId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">交易編號</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {record.transactionId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">用戶</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.primary.main }}>
                      {record.userName?.charAt(0) || record.userId?.charAt(0) || 'U'}
                    </Avatar>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {record.userName || record.userId || '未知用戶'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">狀態</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {(() => {
                      const chipConfig = statusChipMap[(record.status as UiPaymentStatus)] ?? statusChipMap.pending;
                      return (
                        <Chip
                          label={chipConfig.label}
                          size="small"
                          color={chipConfig.color}
                          variant="filled"
                        />
                      );
                    })()}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 金額資訊 */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
              金額資訊
            </Typography>
            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">支付金額</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                    ${formatCurrency(record.amount)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">用電量</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {formatNumber(record.energyConsumed)} kWh
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">支付方式</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    {record.paymentMethod === '信用卡' && <CreditCardIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />}
                    {record.paymentMethod === 'Line Pay' && <AccountBalanceWalletIcon sx={{ color: 'success.main', fontSize: '1.2rem' }} />}
                    {record.paymentMethod === 'Apple Pay' && <AccountBalanceWalletIcon sx={{ color: 'info.main', fontSize: '1.2rem' }} />}
                    {record.paymentMethod === '悠遊卡' && <AccountBalanceWalletIcon sx={{ color: 'warning.main', fontSize: '1.2rem' }} />}
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {record.paymentMethod}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 充電資訊 */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
              充電資訊
            </Typography>
            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">充電站</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {record.cpid} - {record.cpsn}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">充電槍編號</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {record.connectorId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">開始時間</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {record.startTime ? new Date(record.startTime).toLocaleString('zh-TW') : '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">結束時間</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {record.endTime ? new Date(record.endTime).toLocaleString('zh-TW') : '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">充電時長</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {Math.max(0, Math.round(record.chargingDuration ?? 0))} 分鐘
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* 其他資訊 */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
              其他資訊
            </Typography>
            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">用戶 ID</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {record.userId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">ID Tag</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                    {record.idTag || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">建立時間</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {record.createdAt ? new Date(record.createdAt).toLocaleString('zh-TW') : '—'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3
          }}
        >
          關閉
        </Button>
      </DialogActions>
    </Dialog>
  );
}