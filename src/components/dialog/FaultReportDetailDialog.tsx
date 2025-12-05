"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
import type { FaultReport } from '@/app/fault_report/page';

interface FaultReportDetailDialogProps {
  open: boolean;
  loading: boolean;
  report: FaultReport | null;
  onClose: () => void;
  formatDateTime: (value?: string | Date | null) => string;
  getStatusLabel: (status?: string | null) => string;
  getReporterName: (report: FaultReport) => string;
}

export default function FaultReportDetailDialog({
  open,
  loading,
  report,
  onClose,
  formatDateTime,
  getStatusLabel,
  getReporterName
}: FaultReportDetailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>故障詳細資訊</DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && report && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography><strong>編號：</strong>FR-{report.id}</Typography>
            <Typography><strong>樁號：</strong>{report.cpid}</Typography>
            <Typography><strong>回報時間：</strong>{formatDateTime(report.reported_at)}</Typography>
            <Typography><strong>狀態：</strong>{getStatusLabel(report.status)}</Typography>
            <Typography><strong>回報者：</strong>{getReporterName(report)}</Typography>

            <Typography><strong>描述：</strong></Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>
              {report.description || "無描述"}
            </Typography>
            <Typography><strong>解決方法：</strong></Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', color: report.resolution ? 'inherit' : 'text.secondary' }}>
              {report.resolution ?? '尚未提供'}
            </Typography>

            <Typography>
              <strong>指派給：</strong>
              {report.users_fault_reports_assigned_toTousers
                ? `${report.users_fault_reports_assigned_toTousers.first_name ?? ''}${
                    report.users_fault_reports_assigned_toTousers.last_name ?? ''
                  }`.trim() ||
                  report.users_fault_reports_assigned_toTousers.email ||
                  '未提供'
                : '尚未指派'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          關閉
        </Button>
      </DialogActions>
    </Dialog>
  );
}