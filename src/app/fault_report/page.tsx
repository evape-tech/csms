"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Paper,
  Box,
  Card,
  CardContent,
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
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PendingIcon from '@mui/icons-material/Pending';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TableChartIcon from '@mui/icons-material/TableChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { CreateFaultReportDialog } from '@/components/dialog';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '待處理', value: 'REPORTED' },
  { label: '審核中', value: 'UNDER_REVIEW' },
  { label: '處理中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'RESOLVED' },
  { label: '已關閉', value: 'CLOSED' },
];

type FaultReportStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

interface FaultReportUser {
  id?: string | number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface FaultReport {
  id: number;
  cpid?: string | null;
  cpsn?: string | null;
  connector_id?: number | null;
  fault_type?: string | null;
  severity?: string | null;
  description?: string | null;
  status?: FaultReportStatus | string | null;
  reported_at?: string | Date | null;
  resolved_at?: string | Date | null;
  users_fault_reports_user_idTousers?: FaultReportUser | null;
  users_fault_reports_assigned_toTousers?: FaultReportUser | null;
}

interface FaultReportPrefillData {
  cpid?: string | null;
  cpsn?: string | null;
  connector_id?: number | null;
  fault_type?: string | null;
  severity?: string | null;
  description?: string | null;
}

interface SummaryStats {
  total: number;
  pending: number;
  processing: number;
  done: number;
  closed: number;
  critical?: number;
}

const defaultSummary: SummaryStats = {
  total: 0,
  pending: 0,
  processing: 0,
  done: 0,
  closed: 0,
  critical: 0
};

const statusLabelMap: Record<string, string> = {
  REPORTED: '待處理',
  UNDER_REVIEW: '審核中',
  OPEN: '待處理',
  IN_PROGRESS: '處理中',
  RESOLVED: '已完成',
  CLOSED: '已關閉'
};

const statusColorMap: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  REPORTED: 'warning',
  UNDER_REVIEW: 'warning',
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'default'
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getReporterName = (report: FaultReport) => {
  const reporter = report.users_fault_reports_user_idTousers;
  if (!reporter) return '未提供';
  const fullName = `${reporter.first_name ?? ''}${reporter.last_name ?? ''}`.trim();
  if (fullName) return fullName;
  if (reporter.email) return reporter.email;
  return '未提供';
};

const getReportIdentifier = (report: FaultReport) => `FR-${report.id ?? ''}`;

const normalizeFaultReports = (reports: unknown[]): FaultReport[] => {
  if (!Array.isArray(reports)) return [];
  return reports.map((item) => {
    const report = item as FaultReport;
    return {
      ...report,
      id: typeof report.id === 'number' ? report.id : Number(report.id ?? 0),
      reported_at: report.reported_at ? new Date(report.reported_at) : null,
      resolved_at: report.resolved_at ? new Date(report.resolved_at) : null
    };
  });
};

const deriveSummary = (reports: FaultReport[], rawStats?: Record<string, number>): SummaryStats => {
  if (rawStats && Object.keys(rawStats).length > 0) {
    const total = rawStats.total ?? reports.length;
    const open = rawStats.open ?? 0;
    const processing = rawStats.in_progress ?? 0;
    const done = rawStats.resolved ?? 0;
    const closed = rawStats.closed ?? 0;
    const pending = open + Math.max(total - (open + processing + done + closed), 0);

    return {
      total,
      pending,
      processing,
      done,
      closed,
      critical: rawStats.critical ?? reports.filter((r) => r.severity === 'CRITICAL').length
    };
  }

  return reports.reduce<SummaryStats>((acc, report) => {
    const status = report.status ?? 'REPORTED';
    acc.total += 1;
    switch (status) {
      case 'IN_PROGRESS':
        acc.processing += 1;
        break;
      case 'RESOLVED':
        acc.done += 1;
        break;
      case 'CLOSED':
        acc.closed += 1;
        break;
      default:
        acc.pending += 1;
        break;
    }
    return acc;
  }, { ...defaultSummary, total: 0 });
};

export default function FaultReport() {
  const theme = useTheme();
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [faultReports, setFaultReports] = useState<FaultReport[]>([]);
  const [summary, setSummary] = useState<SummaryStats>(defaultSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [faultReportPrefill, setFaultReportPrefill] = useState<FaultReportPrefillData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserUuid, setCurrentUserUuid] = useState<string>('');

  // 通用確認視窗
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const fetchFaultReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', '100');

      const response = await fetch(`/api/fault-reports?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message ?? '取得故障報告失敗');
      }

      const normalizedReports = normalizeFaultReports(data.data?.reports ?? []);
      setFaultReports(normalizedReports);

      const statsPayload = data.data?.stats as Record<string, number> | undefined;
      setSummary(deriveSummary(normalizedReports, statsPayload));
    } catch (err) {
      const message = err instanceof Error ? err.message : '取得故障報告失敗，請稍後再試';
      setError(message);
      setFaultReports([]);
      setSummary(defaultSummary);
      console.error('Fetch fault reports error:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchFaultReports();
  }, [fetchFaultReports]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();    

    const loadUser = async () => {
      try {
      const res = await fetch('/api/users/me', { signal: controller.signal });
      if (!res.ok) throw new Error('unauthorized');
      const data = await res.json();
      if (!active) return;

      const role = data?.user?.role;
      const uuid = data?.user?.uuid || data?.user?.id; // 優先拿 uuid

      setIsAdmin(role === 'admin' || role === 'super_admin');
      setCurrentUserUuid(uuid || ''); // 一定要是字串，不能是 null
        } catch {
          if (!active) return;
          setIsAdmin(false);
          setCurrentUserUuid('');
        } finally {
          if (active) setCheckingAdmin(false);
        }
      };

    loadUser();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleSearch = () => {
    fetchFaultReports();
  };

  const updateFaultReportStatus = async (id: number, nextStatus: FaultReportStatus) => {

  // 👉 調度不跳出確認視窗，直接執行更新
  if (nextStatus === 'IN_PROGRESS') {
    setUpdatingId(id);

    try {
      const response = await fetch(`/api/fault-reports/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message ?? '更新故障報告狀態失敗');
      }

      await fetchFaultReports();
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新故障報告狀態失敗';
      setError(message);
      console.error('Update fault report status error:', err);
    } finally {
      setUpdatingId(null);
    }

    return; // ⬅ 記得跳出，不走下面 confirmDialog
  }

  // 👉 完成 / 關閉：原本的通用確認視窗
  setConfirmDialog({
    open: true,
    title: nextStatus === 'RESOLVED' ? '確認完成？' : '確認關閉？',
    message:
      nextStatus === 'RESOLVED'
        ? '你確定要將此故障回報標記為已完成嗎？'
        : '你確定要關閉此故障報告嗎？',
    onConfirm: async () => {
      setConfirmDialog((prev) => ({ ...prev, open: false }));
      setUpdatingId(id);

      try {
        const response = await fetch(`/api/fault-reports/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: nextStatus })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data?.message ?? '更新故障報告狀態失敗');
        }

        await fetchFaultReports();
      } catch (err) {
        const message = err instanceof Error ? err.message : '更新故障報告狀態失敗';
        setError(message);
        console.error('Update fault report status error:', err);
      } finally {
        setUpdatingId(null);
      }
    },
  });
};



  const handleOpenCreateDialog = (report?: FaultReport) => {
    if (!isAdmin) return;
    setFaultReportPrefill(report ? {
      cpid: report.cpid ?? null,
      cpsn: report.cpsn ?? null,
      connector_id: report.connector_id ?? null,
      fault_type: report.fault_type ?? undefined,
      severity: report.severity ?? undefined,
      description: report.description ?? ''
    } : null);
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setFaultReportPrefill(null);
  };

  const handleCreateSuccess = useCallback(() => {
    setSuccessMessage('故障回報建立成功');
    fetchFaultReports();
  }, [fetchFaultReports]);

  const filteredRows = useMemo(() => {
    return faultReports.filter((row) => {
      const keywordValue = keyword.toLowerCase();
      const matchesKeyword = !keyword ||
        getReportIdentifier(row).toLowerCase().includes(keywordValue) ||
        (row.cpid && row.cpid.toLowerCase().includes(keywordValue)) ||
        (row.cpsn && row.cpsn.toLowerCase().includes(keywordValue)) ||
        (row.description && row.description.toLowerCase().includes(keywordValue)) ||
        getReporterName(row).toLowerCase().includes(keywordValue);

      return matchesKeyword;
    });
  }, [faultReports, keyword]);

  const getStatusLabel = (value?: string | null) => {
    if (!value) return '未知';
    return statusLabelMap[value] ?? value;
  };

  const getStatusColor = (value?: string | null) => {
    if (!value) return 'default';
    return statusColorMap[value] ?? 'default';
  };

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
          <ReportProblemIcon sx={{ fontSize: '2rem' }} />
          故障回報管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          管理充電樁故障報告和維修調度
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
          '& > *': { 
            flex: '1 1 calc(33.333% - 24px)', // 一行三個
            maxWidth: 'calc(33.333% - 24px)',
            minWidth: 240,
           }
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
                  <ReportProblemIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    總故障數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1
                  }}>
                    {summary.total}
                  </Typography>
                  {(summary.critical ?? 0) > 0 && (
                    <Chip
                      label={`重大：${summary.critical}`}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ mt: 1, fontWeight: 500 }}
                    />
                  )}
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
                    待處理
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.warning.main,
                    lineHeight: 1
                  }}>
                    {summary.pending}
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
                  <BuildIcon />
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
                    {summary.processing}
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
                    {summary.done}
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
                    已關閉
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.grey[500],
                    lineHeight: 1
                  }}>
                    {summary.closed}
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
            placeholder="搜尋編號、回報者或描述..."
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

          <Button
            variant="contained"
            size="medium"
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
            onClick={handleSearch}
            disabled={loading}
          >
            查詢
          </Button>
        </Box>
      </Paper>

      {/* 故障報告列表 */}
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
              故障報告列表
            </Typography>
            <Chip
              label={loading ? '載入中…' : `${filteredRows.length} 筆記錄`}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontWeight: 500
              }}
            />
          </Box>
          {isAdmin && !checkingAdmin && (
            <Button
              variant="contained"
              size="medium"
              startIcon={<EngineeringIcon />}
              disabled={loading}
              onClick={() => handleOpenCreateDialog()}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600
              }}
            >
              建立故障回報單
            </Button>
          )}
        </Box>

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}
        {successMessage && (
          <Box sx={{ px: 3 }}>
            <Alert severity="success" onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </Box>
        )}

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
                <TableCell>編號</TableCell>
                <TableCell>樁號</TableCell>
                <TableCell>回報者</TableCell>
                <TableCell>回報時間</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>簡述</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && filteredRows.map((row) => (
                <TableRow
                  key={row.id}
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
                      {getReportIdentifier(row)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.cpid ? `CP ${row.cpid}` : row.cpsn ? `SN ${row.cpsn}` : row.connector_id ? `連接器 ${row.connector_id}` : '未提供'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell>{getReporterName(row)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
                      <Typography variant="body2">{formatDateTime(row.reported_at)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(row.status ?? undefined)}
                      size="small"
                      color={getStatusColor(row.status ?? undefined)}
                      variant={row.status === 'RESOLVED' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {isAdmin && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            textTransform: 'none',
                            borderRadius: 2
                          }}
                          disabled={loading || checkingAdmin}
                          onClick={() => handleOpenCreateDialog(row)}
                        >
                          工單
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          minWidth: 'auto',
                          px: 2,
                          textTransform: 'none',
                          borderRadius: 2
                        }}
                        disabled={loading || updatingId === row.id || row.status === 'IN_PROGRESS'|| row.status === 'RESOLVED'|| row.status === 'CLOSED'}
                        onClick={() => updateFaultReportStatus(row.id, 'IN_PROGRESS')}
                      >
                        調度
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        sx={{
                          minWidth: 'auto',
                          px: 2,
                          textTransform: 'none',
                          borderRadius: 2
                        }}
                        disabled={loading || updatingId === row.id || row.status === 'RESOLVED'|| row.status === 'CLOSED'}
                        onClick={() => updateFaultReportStatus(row.id, 'RESOLVED')}
                      >
                        <AssignmentTurnedInIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                        完成
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        sx={{
                          minWidth: 'auto',
                          px: 2,
                          textTransform: 'none',
                          borderRadius: 2
                        }}
                        disabled={loading || updatingId === row.id || row.status === 'CLOSED'|| row.status === 'RESOLVED'}
                        onClick={() => updateFaultReportStatus(row.id, 'CLOSED')}
                      >
                        <CloseIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
                        關閉
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {loading && (
          <Box sx={{
            p: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && filteredRows.length === 0 && (
          <Box sx={{
            p: 6,
            textAlign: 'center',
            color: theme.palette.text.secondary
          }}>
            <ReportProblemIcon sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              沒有找到符合條件的記錄
            </Typography>
            <Typography variant="body2">
              請調整搜尋條件或檢查拼寫
            </Typography>
          </Box>
        )}
      </Paper>
      <CreateFaultReportDialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        //reporterId={currentUserId || undefined}
        reporterId="qfxzB1ieahqFlqfEPvvZ"
        initialData={faultReportPrefill ?? undefined}
        onSuccess={() => {
          handleCloseCreateDialog();
          handleCreateSuccess();
        }}
      />
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, open: false }))
            }
          >
            取消
          </Button>  
          <Button
            onClick={() => {
              confirmDialog.onConfirm && confirmDialog.onConfirm();
            }}
            variant="contained"
            color="primary"
          >
            確認
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
