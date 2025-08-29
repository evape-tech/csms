"use client";
import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Switch from '@mui/material/Switch';
import { DisclaimerFooter } from '@/components/layout';

const paymentMethods = [
  { id: 1, name: '信用卡', enabled: true },
  { id: 2, name: 'Line Pay', enabled: true },
  { id: 3, name: 'Apple Pay', enabled: false },
  { id: 4, name: '悠遊卡', enabled: true },
  { id: 5, name: 'RFID', enabled: true },
];
const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '成功', value: 'success' },
  { label: '失敗', value: 'fail' },
  { label: '退款', value: 'refund' },
];
const methodOptions = [
  { label: '全部方式', value: '' },
  ...paymentMethods.map(m => ({ label: m.name, value: m.name }))
];
const paymentRows = [
  { id: 1, user: '陳先生', amount: 120, method: '信用卡', status: 'success', time: '2024-06-01 10:20', order: 'ORD001' },
  { id: 2, user: '李小姐', amount: 80, method: 'Line Pay', status: 'fail', time: '2024-06-01 11:10', order: 'ORD002' },
  { id: 3, user: '張大明', amount: 60, method: '悠遊卡', status: 'success', time: '2024-06-02 09:30', order: 'ORD003' },
];

export default function PaymentManagement() {
  const [methods, setMethods] = useState(paymentMethods);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [keyword, setKeyword] = useState('');
  return (
    <Box>
      {/* 支付方式管理區域 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight="bold" mb={1}>支付方式管理</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          {methods.map(m => (
            <Card key={m.id} sx={{ minWidth: 180 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography>{m.name}</Typography>
                  <Switch
                    checked={m.enabled}
                    onChange={(_, checked) => setMethods(list => list.map(x => x.id === m.id ? { ...x, enabled: checked } : x))}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Paper>
      {/* 支付記錄查詢篩選區 */}
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
            label="支付方式"
            size="small"
            value={method}
            onChange={e => setMethod(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            {methodOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
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
      {/* 支付記錄表格 */}
      <Paper sx={{ p: 2 }}>
        <Typography fontWeight="bold" mb={1}>支付記錄</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>用戶</TableCell>
                <TableCell>金額</TableCell>
                <TableCell>方式</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>時間</TableCell>
                <TableCell>訂單編號</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.user}</TableCell>
                  <TableCell>${row.amount}</TableCell>
                  <TableCell>{row.method}</TableCell>
                  <TableCell>{row.status === 'success' ? '成功' : row.status === 'fail' ? '失敗' : '退款'}</TableCell>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>{row.order}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined">詳情</Button>
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
