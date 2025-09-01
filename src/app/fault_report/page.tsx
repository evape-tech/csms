"use client";
import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { DisclaimerFooter } from '@/components/layout';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '待處理', value: 'pending' },
  { label: '處理中', value: 'processing' },
  { label: '已完成', value: 'done' },
  { label: '已關閉', value: 'closed' },
];

const summary = { total: 8, pending: 2, processing: 3, done: 2, closed: 1 };
const faultRows = [
  { id: 1, code: 'F001', charger: 1, reporter: '陳先生', time: '2024-06-01 10:20', status: 'pending', desc: '充電樁無法正常充電' },
  { id: 2, code: 'F002', charger: 6, reporter: '李小姐', time: '2024-06-01 11:10', status: 'processing', desc: '異常斷電' },
  { id: 3, code: 'F003', charger: 2, reporter: '張大明', time: '2024-06-02 09:30', status: 'done', desc: '螢幕無法正常顯示' },
];

export default function FaultReport() {
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  return (
    <Box>
      {/* ?�詢/篩選?� */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="關鍵字搜尋"
            size="small"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            sx={{ minWidth: 160 }}
          />

          <TextField
            select
            label="狀態"
            size="small"
            value={status}
            onChange={e => setStatus(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            {statusOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained">查詢</Button>
        </Stack>
      </Paper>
      {/* 統計概覽（使用 MUI Grid v2） */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">總故障數</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">待處理</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.pending}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">處理中</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.processing}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">已完成</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.done}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">已關閉</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.closed}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {/* 故障報告列表表格 */}
      <Paper sx={{ p: 2 }}>
        <Typography fontWeight="bold" mb={1}>故障報告列表</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
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
              {faultRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.charger}</TableCell>
                  <TableCell>{row.reporter}</TableCell>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>{
                    row.status === 'pending' ? '待處理' :
                    row.status === 'processing' ? '處理中' :
                    row.status === 'done' ? '已完成' : '已關閉'
                  }</TableCell>
                  <TableCell>{row.desc}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" sx={{ mr: 1 }}>調度</Button>
                    <Button size="small" variant="outlined" color="success" sx={{ mr: 1 }}>標記完成</Button>
                    <Button size="small" variant="outlined" color="error">關閉</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      <DisclaimerFooter />
    </Box>
  );
}
