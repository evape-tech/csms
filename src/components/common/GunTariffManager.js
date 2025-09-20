import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon
} from '@mui/icons-material';

const GunTariffManager = ({ gunId, gunName }) => {
  const [gunTariffs, setGunTariffs] = useState([]);
  const [availableTariffs, setAvailableTariffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState(null);
  const [formData, setFormData] = useState({
    tariff_id: '',
    priority: 1,
    is_active: true
  });
  const [error, setError] = useState('');

  // 載入槍的tariff關聯
  const loadGunTariffs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/guns/${gunId}/tariffs`);
      if (response.ok) {
        const data = await response.json();
        setGunTariffs(data);
      } else {
        setError('載入槍的費率關聯失敗');
      }
    } catch (err) {
      console.error('Error loading gun tariffs:', err);
      setError('載入槍的費率關聯失敗');
    } finally {
      setLoading(false);
    }
  };

  // 載入可用的tariff
  const loadAvailableTariffs = async () => {
    try {
      const response = await fetch('/api/tariffs');
      if (response.ok) {
        const result = await response.json();
        setAvailableTariffs(result.data || []);
      }
    } catch (err) {
      console.error('Error loading available tariffs:', err);
    }
  };

  useEffect(() => {
    if (gunId) {
      loadGunTariffs();
      loadAvailableTariffs();
    }
  }, [gunId]);

  // 打開新增/編輯對話框
  const handleOpenDialog = (association = null) => {
    if (association) {
      setEditingAssociation(association);
      setFormData({
        tariff_id: association.tariff_id,
        priority: association.priority,
        is_active: association.is_active
      });
    } else {
      setEditingAssociation(null);
      setFormData({
        tariff_id: '',
        priority: 1,
        is_active: true
      });
    }
    setDialogOpen(true);
    setError('');
  };

  // 關閉對話框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssociation(null);
    setFormData({
      tariff_id: '',
      priority: 1,
      is_active: true
    });
    setError('');
  };

  // 提交表單
  const handleSubmit = async () => {
    if (!formData.tariff_id) {
      setError('請選擇費率方案');
      return;
    }

    try {
      setLoading(true);
      let response;

      if (editingAssociation) {
        // 更新關聯
        response = await fetch(`/api/guns/${gunId}/tariffs`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } else {
        // 新增關聯
        response = await fetch(`/api/guns/${gunId}/tariffs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      }

      if (response.ok) {
        await loadGunTariffs();
        handleCloseDialog();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '操作失敗');
      }
    } catch (err) {
      console.error('Error saving gun tariff association:', err);
      setError('操作失敗');
    } finally {
      setLoading(false);
    }
  };

  // 刪除關聯
  const handleDelete = async (tariffId) => {
    if (!window.confirm('確定要刪除此費率關聯嗎？')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/guns/${gunId}/tariffs?tariff_id=${tariffId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadGunTariffs();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '刪除失敗');
      }
    } catch (err) {
      console.error('Error deleting gun tariff association:', err);
      setError('刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取tariff名稱
  const getTariffName = (tariffId) => {
    const tariff = availableTariffs.find(t => t.id === tariffId);
    return tariff ? tariff.name : `費率 ${tariffId}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {gunName} - 費率關聯管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={loading}
        >
          新增關聯
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>費率方案</TableCell>
              <TableCell>優先級</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>創建時間</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gunTariffs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    尚未設定任何費率關聯
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              gunTariffs.map((association) => (
                <TableRow key={`${association.gun_id}-${association.tariff_id}`}>
                  <TableCell>
                    {getTariffName(association.tariff_id)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`優先級 ${association.priority}`}
                      size="small"
                      color={association.priority === 1 ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={association.is_active ? '啟用' : '停用'}
                      size="small"
                      color={association.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(association.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="編輯">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(association)}
                        disabled={loading}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="刪除">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(association.tariff_id)}
                        disabled={loading}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 新增/編輯對話框 */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAssociation ? '編輯費率關聯' : '新增費率關聯'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>費率方案</InputLabel>
              <Select
                value={formData.tariff_id}
                onChange={(e) => setFormData({ ...formData, tariff_id: e.target.value })}
                label="費率方案"
              >
                {availableTariffs.map((tariff) => (
                  <MenuItem key={tariff.id} value={tariff.id}>
                    {tariff.name} ({tariff.tariff_type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="優先級"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              helperText="優先級數字越小，優先級越高"
              inputProps={{ min: 1 }}
            />

            <FormControl fullWidth>
              <InputLabel>狀態</InputLabel>
              <Select
                value={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                label="狀態"
              >
                <MenuItem value={true}>啟用</MenuItem>
                <MenuItem value={false}>停用</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? '處理中...' : (editingAssociation ? '更新' : '新增')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GunTariffManager;
