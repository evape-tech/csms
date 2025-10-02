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
  CircularProgress,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import PendingIcon from '@mui/icons-material/Pending';
import EngineeringIcon from '@mui/icons-material/Engineering';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TableChartIcon from '@mui/icons-material/TableChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import { CreateMaintenanceDialog } from '../../components/dialog';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '已排程', value: 'SCHEDULED' },
  { label: '處理中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '失敗', value: 'FAILED' },
];

const typeOptions = [
  { label: '全部類型', value: '' },
  { label: '例行維護', value: 'ROUTINE' },
  { label: '故障維修', value: 'REPAIR' },
  { label: '設備升級', value: 'UPGRADE' },
  { label: '檢查', value: 'INSPECTION' },
  { label: '清潔', value: 'CLEANING' },
  { label: '其他', value: 'OTHER' },
];

interface MaintenanceRecord {
  id: string;
  cpid: string;
  cpsn: string;
  connector_id?: number;
  maintenance_type: string;
  priority: string;
  description: string;
  scheduled_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  technician_id?: string;
  technician_name?: string;
  parts_used?: string;
  labor_cost?: number;
  parts_cost?: number;
  total_cost?: number;
  status: string;
  result?: string;
  createdAt?: string;
  updatedAt?: string;
  users_maintenance_records_technician_idTousers?: {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface MaintenanceStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  failed: number;
}

export default function HardwareMaintenance() {
  const theme = useTheme();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [stats, setStats] = useState<MaintenanceStats>({
    total: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('zh-TW');
  };

  // 載入維護記錄數據
  const fetchMaintenanceRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (type) params.append('maintenance_type', type);
      if (keyword) params.append('cpid', keyword);
      
      const response = await fetch(`/api/maintenance-records?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setMaintenanceRecords(data.data.records);
        setStats(data.data.stats);
      } else {
        setError(data.message || '載入數據失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
      console.error('Fetch maintenance records error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 更新維護記錄狀態
  const updateMaintenanceRecordStatus = async (recordId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/maintenance-records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchMaintenanceRecords();
      } else {
        setError(data.message || '更新失敗');
      }
    } catch (err) {
      setError('更新失敗，請稍後再試');
      console.error('Update maintenance record error:', err);
    }
  };

  // 初始載入
  React.useEffect(() => {
    fetchMaintenanceRecords();
  }, [status, type]);

  // 手動搜尋
  const handleSearch = () => {
    fetchMaintenanceRecords();
  };

  // 狀態標籤映射
  const getStatusLabel = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  // 狀態顏色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'info';
      case 'IN_PROGRESS': return 'primary';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'default';
      case 'FAILED': return 'error';
      default: return 'default';
    }
  };

  // 過濾數據
  const filteredRows = maintenanceRecords.filter((record) => {
    const matchesKeyword = !keyword ||
      record.cpid?.toLowerCase().includes(keyword.toLowerCase()) ||
      record.cpsn?.toLowerCase().includes(keyword.toLowerCase()) ||
      record.technician_name?.toLowerCase().includes(keyword.toLowerCase()) ||
      record.description?.toLowerCase().includes(keyword.toLowerCase());

    return matchesKeyword;
  });

  return (
    <>
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
          <BuildIcon sx={{ fontSize: '2rem' }} />
          硬體維護管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          管理充電樁設備的維護工單和維修調度
        </Typography>
        {/* 建立工單按鈕已移至搜尋與篩選區 */}
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
                  <BuildIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    總工單數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1
                  }}>
                    {stats.total}
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
                  <PendingIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    已排程
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.warning.main,
                    lineHeight: 1
                  }}>
                    {stats.scheduled}
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
                  <EngineeringIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    處理中
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.info.main,
                    lineHeight: 1
                  }}>
                    {stats.in_progress}
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
                    已完成
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.success.main,
                    lineHeight: 1
                  }}>
                    {stats.completed}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.grey[500], 0.05),
              border: `1px solid ${alpha(theme.palette.grey[500], 0.1)}`,
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
                  bgcolor: theme.palette.grey[500],
                  mr: 2,
                  width: 48,
                  height: 48
                }}>
                  <CancelIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    已取消
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.grey[500],
                    lineHeight: 1
                  }}>
                    {stats.cancelled}
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
            placeholder="搜尋工單編號、設備、維護人員..."
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

          <TextField
            select
            label="類型篩選"
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
            {loading ? <CircularProgress size={20} /> : '查詢'}
          </Button>
          <Button
            variant="contained"
            size="medium"
            onClick={() => setCreateDialogOpen(true)}
            disabled={loading}
            sx={{
              ml: 2,
              px: 4,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: (theme) => theme.shadows[4],
              '&:hover': {
                boxShadow: (theme) => theme.shadows[8],
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            建立工單
          </Button>
        </Box>
      </Paper>

      {/* 維護工單列表 */}
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
              維護工單列表
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
                <TableCell>工單編號</TableCell>
                <TableCell>設備</TableCell>
                <TableCell>類型</TableCell>
                <TableCell>維護人員</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>建立時間</TableCell>
                <TableCell>完成時間</TableCell>
                <TableCell>簡述</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((record) => (
                <TableRow
                  key={record.id}
                  sx={{
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.02)
                    },
                    '& .MuiTableCell-root': {
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                    }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                      M{record.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {record.cpid}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {record.cpsn}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        typeOptions.find(opt => opt.value === record.maintenance_type)?.label || record.maintenance_type
                      }
                      size="small"
                      color={
                        record.maintenance_type === 'ROUTINE' ? 'info' :
                        record.maintenance_type === 'REPAIR' ? 'warning' : 'success'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EngineeringIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                      <Typography variant="body2">
                        {record.technician_name || record.users_maintenance_records_technician_idTousers?.first_name + ' ' + record.users_maintenance_records_technician_idTousers?.last_name || '-'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(record.status)}
                      size="small"
                      color={getStatusColor(record.status) as any}
                      variant={record.status === 'COMPLETED' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                      <Typography variant="body2">
                        {formatDate(record.createdAt)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {record.actual_end_date ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: '1rem', color: theme.palette.success.main }} />
                        <Typography variant="body2">
                          {new Date(record.actual_end_date).toLocaleDateString('zh-TW')}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {record.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => updateMaintenanceRecordStatus(record.id, 'COMPLETED')}
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            textTransform: 'none',
                            borderRadius: 2
                          }}
                        >
                          <AssignmentTurnedInIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                          完成
                        </Button>
                      )}
                      {record.status !== 'CANCELLED' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => updateMaintenanceRecordStatus(record.id, 'CANCELLED')}
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            textTransform: 'none',
                            borderRadius: 2
                          }}
                        >
                          <CloseIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                          取消
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredRows.length === 0 && (
          <Box sx={{
            p: 6,
            textAlign: 'center',
            color: theme.palette.text.secondary
          }}>
            <BuildIcon sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              沒有找到符合條件的記錄
            </Typography>
            <Typography variant="body2">
              請調整搜尋條件或檢查拼寫
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
    <CreateMaintenanceDialog
      open={createDialogOpen}
      onClose={() => setCreateDialogOpen(false)}
      onCreate={(record) => {
        // 新增完成後重新載入表格
        fetchMaintenanceRecords();
        setCreateDialogOpen(false);
      }}
    />
    </>
  );
}
