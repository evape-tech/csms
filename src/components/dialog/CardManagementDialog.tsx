"use client";
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Paper,
  Tabs,
  Tab,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AddCard as AddCardIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  History as HistoryIcon
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`card-tabpanel-${index}`}
      aria-labelledby={`card-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface CardManagementDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    uuid?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    role: string;
  } | null;
}

export default function CardManagementDialog({ 
  open, 
  onClose, 
  user 
}: CardManagementDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // RFID 卡片相關狀態
  const [userCards, setUserCards] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardType, setCardType] = useState('RFID');
  const [cardStatus, setCardStatus] = useState('ACTIVE');

  // 錢包相關狀態
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // 儲值表單
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  
  // 扣款表單
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');
  const [deductNote, setDeductNote] = useState('');

  // 獲取用戶 RFID 卡片信息
  const fetchUserCards = async () => {
    if (!user?.uuid && !user?.id) return;
    
    try {
      const userId = user.uuid || user.id;
      const response = await fetch(`/api/users/${userId}/cards`, { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('獲取卡片信息失敗');
      
      const data = await response.json();
      setUserCards(data.cards || []);
    } catch (err) {
      console.error('獲取卡片信息失敗:', err);
      setError('獲取卡片信息失敗');
    }
  };

  // 獲取可用的支付方式
  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/billing/channels', { 
        credentials: 'include' 
      });
      if (response.ok) {
        const data = await response.json();
        const activeMethods = data.data?.filter((method: any) => method.status === 1) || [];
        setPaymentMethods(activeMethods);
        
        // 設置默認支付方式
        if (activeMethods.length > 0 && !topUpMethod) {
          setTopUpMethod(activeMethods[0].code);
        }
      }
    } catch (err) {
      console.error('獲取支付方式失敗:', err);
      // 如果獲取失敗，使用備用默認值
      setPaymentMethods([
        { code: 'cash', name: '現金', status: 1 },
        { code: 'rfid', name: 'RFID', status: 1 }
      ]);
      if (!topUpMethod) {
        setTopUpMethod('cash');
      }
    }
  };

  // 獲取錢包餘額和交易記錄
  const fetchWalletData = async () => {
    if (!user?.uuid && !user?.id) return;
    
    try {
      const userId = user.uuid || user.id;
      
      // 獲取錢包餘額
      const walletResponse = await fetch(`/api/users/${userId}/wallet`, { 
        credentials: 'include' 
      });
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setWalletBalance(walletData.balance || 0);
      }
      
      // 獲取交易記錄
      const transactionsResponse = await fetch(`/api/users/${userId}/transactions`, { 
        credentials: 'include' 
      });
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData.transactions || []);
      }
    } catch (err) {
      console.error('獲取錢包數據失敗:', err);
    }
  };

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      Promise.all([fetchUserCards(), fetchWalletData(), fetchPaymentMethods()]).finally(() => {
        setLoading(false);
      });
      setError('');
      setSuccess('');
    }
  }, [open, user]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
  };

  // 處理添加新卡片
  const handleAddCard = () => {
    setShowAddForm(true);
    setEditingCard(null);
    setCardNumber('');
    setCardType('RFID');
    setCardStatus('ACTIVE');
  };

  // 處理編輯卡片
  const handleEditCard = (card: any) => {
    setEditingCard(card);
    setShowAddForm(true);
    setCardNumber(card.card_number);
    setCardType(card.card_type);
    setCardStatus(card.status);
  };

  // 處理保存卡片
  const handleSaveCard = async () => {
    if (!cardNumber.trim()) {
      setError('請輸入卡片號碼');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        card_number: cardNumber,
        card_type: cardType,
        status: cardStatus,
        user_id: user?.uuid || user?.id
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        // 若你已在 .env 設定 NEXT_PUBLIC_ADMIN_API_KEY，會自動帶入；否則可暫時使用開發用 key
        'X-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'admin-secret-key'
      };

      console.debug('[UI] POST /api/cards', { headers, payload });

      let response;
      if (editingCard) {
        response = await fetch(`/api/cards/${editingCard.id}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/cards', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      const text = await response.text().catch(() => null);
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = text; }
      console.debug('[UI] /api/cards response', { status: response.status, body: json });

      if (!response.ok) {
        const msg = (json && (json.error || json.message)) ? (json.error || json.message) : `Status ${response.status}`;
        throw new Error(editingCard ? `更新卡片失敗: ${msg}` : `新增卡片失敗: ${msg}`);
      }

      setSuccess(editingCard ? '卡片更新成功' : '卡片新增成功');
      setShowAddForm(false);
      fetchUserCards();
    } catch (err: any) {
      console.error('新增/更新卡片失敗:', err);
      setError(err.message || '新增卡片失敗');
    } finally {
      setLoading(false);
    }
  };

  // 處理刪除卡片
  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('確定要刪除這張卡片嗎？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('刪除卡片失敗');

      setSuccess('卡片刪除成功');
      fetchUserCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 處理儲值
  const handleTopUp = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      setError('請輸入有效的儲值金額');
      return;
    }

    setLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.uuid || user?.id,
          amount: parseFloat(topUpAmount),
          method: topUpMethod,
          note: topUpNote
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // 如果需要重定向到登入頁面
        if (errorData.redirectTo && errorData.redirectTo === '/login') {
          window.location.href = '/login';
          return;
        }
        
        throw new Error(errorData.error || '儲值失敗');
      }

      setSuccess(`成功儲值 $${topUpAmount}`);
      setTopUpAmount('');
      setTopUpNote('');
      fetchWalletData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 處理扣款
  const handleDeduct = async () => {
    if (!deductAmount || parseFloat(deductAmount) <= 0) {
      setError('請輸入有效的扣款金額');
      return;
    }

    if (!deductReason.trim()) {
      setError('請輸入扣款原因');
      return;
    }

    setLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const response = await fetch('/api/wallet/deduct', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.uuid || user?.id,
          amount: parseFloat(deductAmount),
          reason: deductReason,
          note: deductNote
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // 如果需要重定向到登入頁面
        if (errorData.redirectTo && errorData.redirectTo === '/login') {
          window.location.href = '/login';
          return;
        }
        
        throw new Error(errorData.error || '扣款失敗');
      }

      setSuccess(`成功扣款 $${deductAmount}`);
      setDeductAmount('');
      setDeductReason('');
      setDeductNote('');
      fetchWalletData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveTab(0);
    setShowAddForm(false);
    setEditingCard(null);
    setError('');
    setSuccess('');
    setTopUpAmount('');
    setTopUpNote('');
    setDeductAmount('');
    setDeductReason('');
    setDeductNote('');
    onClose();
  };

  const displayName = (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : '') ||
    user?.email || '未知用戶';

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CreditCardIcon />
        卡片與錢包管理 - {displayName}
      </DialogTitle>
      
      <DialogContent>
        {/* 錯誤和成功提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* 用戶信息和錢包餘額 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PersonIcon color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WalletIcon color="primary" />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    錢包餘額
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    ${walletBalance.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 標籤頁 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab 
              icon={<CreditCardIcon />} 
              iconPosition="start"
              label="RFID 卡片" 
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<AddIcon />} 
              iconPosition="start"
              label="儲值" 
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<RemoveIcon />} 
              iconPosition="start"
              label="扣款" 
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<HistoryIcon />} 
              iconPosition="start"
              label="交易記錄" 
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          </Tabs>
        </Box>

        {/* RFID 卡片標籤頁 */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={3}>
            {/* 卡片管理操作區 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={600}>
                已綁定的 RFID 卡片
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddCardIcon />}
                onClick={handleAddCard}
                disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                新增卡片
              </Button>
            </Box>

            {/* 卡片列表 */}
            {userCards.length > 0 ? (
              <Stack spacing={2}>
                {userCards.map((card) => (
                  <Card key={card.id} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <CreditCardIcon color="primary" sx={{ fontSize: 28 }} />
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {card.card_number}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              類型: {card.card_type} • 創建時間: {new Date(card.created_at).toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={card.status === 'ACTIVE' ? '啟用' : card.status === 'INACTIVE' ? '停用' : '未知'}
                            color={card.status === 'ACTIVE' ? 'success' : card.status === 'INACTIVE' ? 'error' : 'default'}
                            size="small"
                          />
                          <IconButton 
                            onClick={() => handleEditCard(card)}
                            size="small"
                            disabled={loading}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton 
                            onClick={() => handleDeleteCard(card.id)}
                            size="small"
                            color="error"
                            disabled={loading}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <CreditCardIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  尚未綁定任何 RFID 卡片
                </Typography>
              </Paper>
            )}

            {/* 卡片表單 */}
            {showAddForm && (
              <Card sx={{ mt: 3, border: '2px solid', borderColor: 'primary.main' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddCardIcon />
                    {editingCard ? '編輯卡片' : '新增卡片'}
                  </Typography>
                  
                  <Stack spacing={3}>
                    <TextField
                      label="卡片號碼"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      fullWidth
                      required
                      placeholder="請輸入 RFID 卡片號碼"
                    />
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>卡片類型</InputLabel>
                        <Select
                          value={cardType}
                          label="卡片類型"
                          onChange={(e) => setCardType(e.target.value)}
                        >
                          <MenuItem value="RFID">RFID</MenuItem>
                          <MenuItem value="NFC">NFC</MenuItem>
                          <MenuItem value="MIFARE">MIFARE</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>狀態</InputLabel>
                        <Select
                          value={cardStatus}
                          label="狀態"
                          onChange={(e) => setCardStatus(e.target.value)}
                        >
                          <MenuItem value="ACTIVE">啟用</MenuItem>
                          <MenuItem value="INACTIVE">停用</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={() => setShowAddForm(false)}
                        disabled={loading}
                      >
                        取消
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleSaveCard}
                        disabled={loading || !cardNumber.trim()}
                      >
                        {editingCard ? '更新' : '新增'}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </TabPanel>

        {/* 儲值標籤頁 */}
        <TabPanel value={activeTab} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon />
                錢包儲值
              </Typography>
              
              <Stack spacing={3}>
                <TextField
                  label="儲值金額"
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ min: 0, step: 0.01 }}
                  placeholder="請輸入儲值金額"
                />
                
                <FormControl fullWidth>
                  <InputLabel>儲值方式</InputLabel>
                  <Select
                    value={topUpMethod}
                    label="儲值方式"
                    onChange={(e) => setTopUpMethod(e.target.value)}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.code} value={method.code}>
                        {method.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  label="備註"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="可選：儲值原因或備註說明"
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleTopUp}
                    disabled={loading || !topUpAmount || parseFloat(topUpAmount) <= 0}
                    color="success"
                    size="large"
                    sx={{ textTransform: 'none', minWidth: 120 }}
                  >
                    確認儲值
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>

        {/* 扣款標籤頁 */}
        <TabPanel value={activeTab} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <RemoveIcon />
                錢包扣款
              </Typography>
              
              <Stack spacing={3}>
                <TextField
                  label="扣款金額"
                  type="number"
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ min: 0, step: 0.01, max: walletBalance }}
                  placeholder="請輸入扣款金額"
                  helperText={`目前餘額: $${walletBalance.toFixed(2)}`}
                />
                
                <TextField
                  label="扣款原因"
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  fullWidth
                  required
                  placeholder="請輸入扣款原因"
                />
                
                <TextField
                  label="詳細備註"
                  value={deductNote}
                  onChange={(e) => setDeductNote(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="可選：詳細說明或備註"
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleDeduct}
                    disabled={loading || !deductAmount || !deductReason || parseFloat(deductAmount) <= 0}
                    color="error"
                    size="large"
                    sx={{ textTransform: 'none', minWidth: 120 }}
                  >
                    確認扣款
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>

        {/* 交易記錄標籤頁 */}
        <TabPanel value={activeTab} index={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                交易記錄
              </Typography>
              
              {transactions.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>時間</TableCell>
                        <TableCell>類型</TableCell>
                        <TableCell align="right">金額</TableCell>
                        <TableCell align="right">餘額</TableCell>
                        <TableCell>說明</TableCell>
                        <TableCell>操作者</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(transaction.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.type === 'topup' ? '儲值' : transaction.type === 'deduct' ? '扣款' : '其他'}
                              color={transaction.type === 'topup' ? 'success' : transaction.type === 'deduct' ? 'error' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              color={transaction.type === 'topup' ? 'success.main' : 'error.main'}
                              fontWeight={600}
                            >
                              {transaction.type === 'topup' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            ${transaction.balance_after?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            {transaction.note || transaction.reason || '-'}
                          </TableCell>
                          <TableCell>
                            {transaction.admin_name || 'System'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <HistoryIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    暫無交易記錄
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="large" sx={{ textTransform: 'none' }}>
          關閉
        </Button>
      </DialogActions>
    </Dialog>
  );
}