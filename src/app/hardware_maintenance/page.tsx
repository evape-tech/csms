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
const typeOptions = [
  { label: '全部類型', value: '' },
  { label: '定期保養', value: 'regular' },
  { label: '故障維修', value: 'repair' },
  { label: '設備升級', value: 'upgrade' },
];

const summary = { total: 6, pending: 1, processing: 2, done: 2, closed: 1 };
const workRows = [
  { id: 1, code: 'M001', device: '樁1', type: 'regular', staff: '李技師', status: 'pending', created: '2024-06-01', finished: '', desc: '定期保養' },
  { id: 2, code: 'M002', device: '樁6', type: 'repair', staff: '王工程師', status: 'processing', created: '2024-06-02', finished: '', desc: '充電接頭' },
  { id: 3, code: 'M003', device: '樁2', type: 'done', staff: '張大明', status: 'done', created: '2024-06-03', finished: '2024-06-04', desc: '軟體更新' },
];

export default function HardwareMaintenance() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  return (
    <Box>
      {/* 查詢/篩選區 */}
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
          <TextField
            select
            label="類型"
            size="small"
            value={type}
            onChange={e => setType(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            {typeOptions.map(opt => (
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
              <Typography color="text.secondary">總工單數</Typography>
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
      {/* 維護工單列表表格 */}
      <Paper sx={{ p: 2 }}>
        <Typography fontWeight="bold" mb={1}>維護工單列表</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
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
              {workRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.device}</TableCell>
                  <TableCell>{row.type === 'regular' ? '定期保養' : row.type === 'repair' ? '故障維修' : '設備升級'}</TableCell>
                  <TableCell>{row.staff}</TableCell>
                  <TableCell>{
                    row.status === 'pending' ? '待處理' :
                    row.status === 'processing' ? '處理中' :
                    row.status === 'done' ? '已完成' : '已關閉'
                  }</TableCell>
                  <TableCell>{row.created}</TableCell>
                  <TableCell>{row.finished}</TableCell>
                  <TableCell>{row.desc}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" sx={{ mr: 1 }}>詳情</Button>
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
