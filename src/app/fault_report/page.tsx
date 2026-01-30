"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Typography,  Paper,  Box,  Card,  CardContent,  Button,  TextField,  MenuItem,  Table,  TableBody,
  TableCell,  TableContainer,  TableHead,  TableRow,  Container,  Chip,  Avatar,  InputAdornment,  useTheme,
  alpha,  CircularProgress,  Alert, Dialog, DialogTitle, DialogContent, DialogActions
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
import { CreateFaultReportDialog, FaultReportDetailDialog, FaultAssignDialog, ResolutionDialog } from '@/components/dialog';

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

export interface FaultReportUser {
  id?: string | number;
  uuid?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface FaultReport {
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
  resolution?: string | null;
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

type AssignDialogState = {
  open: boolean;
  reportId: number | null;
  assignedTo: string;
  assignedUserInfo: FaultReportUser | null;
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

const normalizeIdentifier = (value?: string | number | null) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const dedupeUsersById = (users: FaultReportUser[] = []) => {
  const uniqueMap = new Map<string, FaultReportUser>();
  users.forEach((user) => {
    const optionValue = normalizeIdentifier(user.uuid ?? user.id);
    if (!optionValue || uniqueMap.has(optionValue)) return;
    uniqueMap.set(optionValue, { ...user, uuid: optionValue });
  });
  return Array.from(uniqueMap.values());
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
  return reports.map((item: any) => ({
    ...item,
    id: Number(item.id ?? 0),
    reported_at: item.reported_at ? new Date(item.reported_at) : null,
    resolved_at: item.resolved_at ? new Date(item.resolved_at) : null,
    resolution: item.resolution ?? null,
    // 保留 uuid
    users_fault_reports_assigned_toTousers: item.users_fault_reports_assigned_toTousers
      ? {
          ...item.users_fault_reports_assigned_toTousers,
          uuid: normalizeIdentifier(item.users_fault_reports_assigned_toTousers.uuid || item.users_fault_reports_assigned_toTousers.id)
        }
      : null,
    users_fault_reports_user_idTousers: item.users_fault_reports_user_idTousers
      ? {
          ...item.users_fault_reports_user_idTousers,
          uuid: normalizeIdentifier(item.users_fault_reports_user_idTousers.uuid || item.users_fault_reports_user_idTousers.id)
        }
      : null,
  }));
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

const initialAssignDialogState: AssignDialogState = {
  open: false,
  reportId: null,
  assignedTo: '',
  assignedUserInfo: null
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
  const [managers, setManagers] = useState<FaultReportUser[]>([]);
  const [detailDialog, setDetailDialog] = useState({
    open: false,
    loading: false,
    report: null as FaultReport | null
  });
  const [assignDialog, setAssignDialog] = useState<AssignDialogState>(initialAssignDialogState);
  
  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean;
    reportId: number | null;
    resolution: string;
  }>({ open: false, reportId: null, resolution: '' });

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

  // 確認視窗內的 loading 狀態（避免重複點擊）
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  const resetAssignDialog = () => setAssignDialog(initialAssignDialogState);

  const fetchFaultDetail = async (id: number) => {
  setDetailDialog({ open: true, loading: true, report: null });

  try {
    const res = await fetch(`/api/fault-reports/${id}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "取得詳細資料失敗");
    }

    setDetailDialog({
      open: true,
      loading: false,
      report: data.data
    });

  } catch (err: any) {
    console.error("Load detail error:", err);
    setDetailDialog({
      open: true,
      loading: false,
      report: null
    });
  }
};

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
  const loadManagers = async () => {
    try {
      const res = await fetch('/api/users?role=admin');
      const result = await res.json();

      if (result.success && Array.isArray(result.data)) {
        const formatted = result.data.map((user: any) => {
          const stableUuid = normalizeIdentifier(user?.uuid ?? user?.id);
          return {
            id: stableUuid,
            uuid: stableUuid,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || ''
          };
        });
        setManagers(formatted);
      } else {
        setManagers([]);
      }
    } catch (err) {
      console.error('載入管理員失敗');
      setManagers([]);
    }
  };
  loadManagers();
}, []);

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
      setCurrentUserUuid(uuid || ''); 
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

  const normalizedManagers = useMemo(() => {
    return dedupeUsersById(managers);
  }, [managers]);

  const resolvedManagerOptions = useMemo(() => {
    const currentValue = normalizeIdentifier(assignDialog.assignedTo);
    if (!currentValue) return normalizedManagers;

    const hasMatch = normalizedManagers.some((user) => {
      const optionValue = normalizeIdentifier(user.uuid ?? user.id);
      return optionValue === currentValue;
    });

    if (hasMatch) return normalizedManagers;

    if (!assignDialog.assignedUserInfo) return normalizedManagers;

    const fallbackUser = {
      ...assignDialog.assignedUserInfo,
      uuid: currentValue || assignDialog.assignedUserInfo.uuid
    };

    return dedupeUsersById([
      ...normalizedManagers,
      fallbackUser
    ]);
  }, [normalizedManagers, assignDialog.assignedTo, assignDialog.assignedUserInfo]);

  const handleSearch = () => {
    fetchFaultReports();
  };

  const handleAssignConfirm = async () => {
    const targetAssignee = normalizeIdentifier(assignDialog.assignedTo);
    if (!assignDialog.reportId || !targetAssignee) return;
  
    const reportId = assignDialog.reportId;
  
    setUpdatingId(reportId);
  
    try {
      const res = await fetch(`/api/fault-reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          assigned_to: targetAssignee
        }),
      });
  
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "更新失敗");
  
      // 記錄成功的調度操作
      try {
        await fetch('/api/operation-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: 'UPDATE',
            entityType: 'FAULT_REPORT',
            entityId: String(reportId),
            entityName: `FR-${reportId}`,
            description: `調度故障回報給維修人員 (ID: ${targetAssignee})`,
            status: 'SUCCESS'
          })
        });
      } catch (logErr) {
        console.warn('[fault-report] log assign success failed:', logErr);
      }
  
      resetAssignDialog();
      await fetchFaultReports();
  
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : "調度失敗";
      
      // 記錄失敗的調度操作
      try {
        await fetch('/api/operation-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: 'UPDATE',
            entityType: 'FAULT_REPORT',
            entityId: String(reportId),
            entityName: `FR-${reportId}`,
            description: `調度故障回報失敗: ${errorMsg}`,
            status: 'FAILED'
          })
        });
      } catch (logErr) {
        console.warn('[fault-report] log assign failure failed:', logErr);
      }
      
      setError("調度失敗，請稍後再試");
    } finally {
      setUpdatingId(null);
    }
  };


  const updateFaultReportStatus = async (id: number, nextStatus: FaultReportStatus) => {
    // 調度不跳出確認視窗，直接執行更新
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
  
      return; 
    }
  
    // 完成（RESOLVED）：開啟輸入解決方案的對話框
    if (nextStatus === 'RESOLVED') {
      blurActiveElement();
      setResolutionDialog({ open: true, reportId: id, resolution: '' });
      return;
    }

    // 關閉（CLOSED）：保留原先的確認視窗行為
    setConfirmDialog({
      open: true,
      title: '確認關閉？',
      message: '你確定要關閉此故障報告嗎？',
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
  
          // 記錄成功的關閉操作
          try {
            await fetch('/api/operation-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                actionType: 'UPDATE',
                entityType: 'FAULT_REPORT',
                entityId: String(id),
                entityName: `FR-${id}`,
                description: '關閉故障回報',
                status: 'SUCCESS'
              })
            });
          } catch (logErr) {
            console.warn('[fault-report] log close success failed:', logErr);
          }
  
          await fetchFaultReports();
        } catch (err) {
          const message = err instanceof Error ? err.message : '更新故障報告狀態失敗';
          
          // 記錄失敗的關閉操作
          try {
            await fetch('/api/operation-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                actionType: 'UPDATE',
                entityType: 'FAULT_REPORT',
                entityId: String(id),
                entityName: `FR-${id}`,
                description: `關閉故障回報失敗: ${message}`,
                status: 'FAILED'
              })
            });
          } catch (logErr) {
            console.warn('[fault-report] log close failure failed:', logErr);
          }
          
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

  const blurActiveElement = () => {
    try {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === 'function') el.blur();
    } catch (e) {// 忽略：防止 SSR 或環境錯誤
    }
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
                          onClick={() => fetchFaultDetail(row.id)}
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
                        onClick={() => {
                          // 防呆：無論後端回傳什麼，找出 uuid 或 id
                          const assignedUser = row.users_fault_reports_assigned_toTousers;
                          const assignedUuid = normalizeIdentifier(assignedUser?.uuid || assignedUser?.id);  // 如果只有 id，就轉成字串
                          
                          setAssignDialog({
                            open: true,
                            reportId: row.id,
                            assignedTo: assignedUuid,   
                            assignedUserInfo: row.users_fault_reports_assigned_toTousers ?? null
                          });
                        }}
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
        reporterId={currentUserUuid || undefined}
        initialData={faultReportPrefill ?? undefined}
        onSuccess={() => {
          handleCloseCreateDialog();
          handleCreateSuccess();
        }}
      />
      <FaultReportDetailDialog
        open={detailDialog.open}
        loading={detailDialog.loading}
        report={detailDialog.report}
        onClose={() => setDetailDialog({ open: false, loading: false, report: null })}
        formatDateTime={formatDateTime}
        getStatusLabel={getStatusLabel}
        getReporterName={getReporterName}
      />
      <FaultAssignDialog
        open={assignDialog.open}
        assignedTo={assignDialog.assignedTo}
        assignedUserInfo={assignDialog.assignedUserInfo}
        managerOptions={resolvedManagerOptions}
        onChangeAssignedTo={(value) =>
           setAssignDialog((prev) => ({ ...prev, assignedTo: value }))
         }
        onConfirm={handleAssignConfirm}
        onClose={resetAssignDialog}
      />
      <ResolutionDialog
        open={resolutionDialog.open}
        reportId={resolutionDialog.reportId}
        initialValue={resolutionDialog.resolution}
        onClose={() => setResolutionDialog({ open: false, reportId: null, resolution: '' })}
        onConfirm={async (resolutionText: string) => {
          const id = resolutionDialog.reportId;
          if (!id) return;
          setUpdatingId(id);
          try {
            const res = await fetch(`/api/fault-reports/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'RESOLVED', resolution: resolutionText })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data?.message ?? '更新故障報告失敗');
            }
            
            // 記錄成功的完成操作
            try {
              await fetch('/api/operation-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actionType: 'UPDATE',
                  entityType: 'FAULT_REPORT',
                  entityId: String(id),
                  entityName: `FR-${id}`,
                  description: `完成故障回報，解決方案: ${resolutionText.substring(0, 50)}${resolutionText.length > 50 ? '...' : ''}`,
                  status: 'SUCCESS'
                })
              });
            } catch (logErr) {
              console.warn('[fault-report] log resolve success failed:', logErr);
            }
            
            setResolutionDialog({ open: false, reportId: null, resolution: '' });
            setSuccessMessage('故障回報已標記為已完成');
            await fetchFaultReports();
          } catch (err: any) {
            const message = err instanceof Error ? err.message : '更新失敗';
            
            // 記錄失敗的完成操作
            try {
              await fetch('/api/operation-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actionType: 'UPDATE',
                  entityType: 'FAULT_REPORT',
                  entityId: String(id),
                  entityName: `FR-${id}`,
                  description: `完成故障回報失敗: ${message}`,
                  status: 'FAILED'
                })
              });
            } catch (logErr) {
              console.warn('[fault-report] log resolve failure failed:', logErr);
            }
            
            setError(message);
            console.error('Resolve error:', err);
          } finally {
            setUpdatingId(null);
          }
        }}
      />
      {/* 通用確認對話框（用於「關閉」等需要二次確認的操作） */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => {
          if (!confirmLoading) setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
            size="small"
            disabled={confirmLoading}
          >
            取消
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={async () => {
              if (!confirmDialog.onConfirm) {
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                return;
              }
              setConfirmLoading(true);
              try {
                // 有些 onConfirm 是 async 函式（我們強制以 any 呼叫並 await）
                await (confirmDialog.onConfirm as any)();
              } catch (err) {
                console.error('confirmDialog onConfirm error:', err);
                setError((err instanceof Error) ? err.message : '操作失敗');
              } finally {
                setConfirmLoading(false);
                // 確保視窗關閉（onConfirm 裡面也可能關閉一次，這裡保險處理）
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }
            }}
            disabled={confirmLoading}
            startIcon={confirmLoading ? <CircularProgress size={16} /> : undefined}
          >
            確認
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
