"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import type { FaultReportUser } from '@/app/operations-reports/fault_report/page';

export interface FaultAssignDialogProps {
  open: boolean;
  assignedTo: string;
  assignedUserInfo: FaultReportUser | null;
  managerOptions: FaultReportUser[];
  onChangeAssignedTo: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const normalizeIdentifier = (value?: string | number | null) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export default function FaultAssignDialog({
  open,
  assignedTo,
  assignedUserInfo,
  managerOptions,
  onChangeAssignedTo,
  onConfirm,
  onClose
}: FaultAssignDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>選擇指派人員</DialogTitle>

      <DialogContent dividers>
        <FormControl fullWidth>
          <InputLabel id="assign-to-label">指派給</InputLabel>

          <Select
            labelId="assign-to-label"
            label="指派給"
            value={assignedTo || ''}
            onChange={(e) => onChangeAssignedTo(e.target.value as string)}
            renderValue={(selected) => {
              if (!selected) return <em style={{ opacity: 0.6 }}>未指派</em>;

              const manager = managerOptions.find(m =>
                normalizeIdentifier(m.uuid ?? m.id) === selected
              );

              if (manager) {
                const name = `${manager.first_name || ''}${manager.last_name || ''}`.trim();
                const displayName = name || manager.email || '未知使用者';
                return <strong>{displayName}（{manager.email}）</strong>;
              }

              const fallback = assignedUserInfo;
              if (fallback) {
                const name = `${fallback.first_name || ''}${fallback.last_name || ''}`.trim();
                const displayName = name || fallback.email || '未知使用者';
                return (
                  <span style={{ opacity: 0.7 }}>
                    {displayName}（{fallback.email || '無信箱'}）
                  </span>
                );
              }

              return selected;
            }}
          >
            {managerOptions.map((u) => {
              const optionValue = normalizeIdentifier(u.uuid ?? u.id);
              if (!optionValue) return null;
              return (
                <MenuItem key={optionValue} value={optionValue}>
                  {u.first_name}{u.last_name}（{u.email}）
                </MenuItem>
              );
            })}

            {managerOptions.length === 0 && (
              <MenuItem disabled value="">
                <em>無可指派的管理員</em>
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          取消
        </Button>

        <Button
          disabled={!assignedTo}
          variant="contained"
          onClick={onConfirm}
        >
          確認調度
        </Button>
      </DialogActions>
    </Dialog>
  );
}


