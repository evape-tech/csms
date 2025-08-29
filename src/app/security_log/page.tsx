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
import Chip from '@mui/material/Chip';
import { DisclaimerFooter } from '@/components/layout';

const typeOptions = [
  { label: '全部類型', value: '' },
  { label: '登入', value: 'login' },
  { label: '登出', value: 'logout' },
  { label: '異常', value: 'abnormal' },
  { label: '權限變更', value: 'role' },
  { label: '資料操作', value: 'data' },
];
const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '成功', value: 'success' },
  { label: '失敗', value: 'fail' },
  { label: '警告', value: 'warning' },
];
const summary = { total: 20, abnormal: 2, warning: 3, login: 10, logout: 5 };
const logRows = [
  { id: 1, code: 'L001', time: '2024-06-01 10:20', user: '陳先生', ip: '192.168.1.10', type: 'login', status: 'success', desc: '登入系統' },
  { id: 2, code: 'L002', time: '2024-06-01 11:10', user: '李小姐', ip: '192.168.1.11', type: 'abnormal', status: 'warning', desc: '多次密碼錯誤' },
  { id: 3, code: 'L003', time: '2024-06-02 09:30', user: '張大明', ip: '192.168.1.12', type: 'role', status: 'success', desc: '權限修改' },
  { id: 4, code: 'L004', time: '2024-06-02 10:00', user: '陳先生', ip: '192.168.1.10', type: 'abnormal', status: 'fail', desc: '異常登出' },
];

export default function SecurityLog() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" gap={1}>
          <Button variant="outlined" size="small">匯出 Excel</Button>
          <Button variant="outlined" size="small">匯出 CSV</Button>
          <Button variant="outlined" size="small">匯出 PDF</Button>
        </Box>
      </Box>
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
            label="事件類型"
            size="small"
            value={type}
            onChange={e => setType(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            {typeOptions.map(opt => (
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
      {/* 統計概覽（使用 Box + CSS Grid） */}
      <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(5,1fr)' } }}>
        <Card>
          <CardContent>
            <Typography color="text.secondary">總事件數</Typography>
            <Typography variant="h6" fontWeight="bold">{summary.total}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">異常事件</Typography>
            <Typography variant="h6" fontWeight="bold">{summary.abnormal}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">警告事件</Typography>
            <Typography variant="h6" fontWeight="bold">{summary.warning}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">登入事件</Typography>
            <Typography variant="h6" fontWeight="bold">{summary.login}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary">登出事件</Typography>
            <Typography variant="h6" fontWeight="bold">{summary.logout}</Typography>
          </CardContent>
        </Card>
      </Box>
      {/* 安全日誌表格 */}
      <Paper sx={{ p: 2 }}>
        <Typography fontWeight="bold" mb={1}>安全日誌列表</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>事件編號</TableCell>
                <TableCell>時間</TableCell>
                <TableCell>用戶</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>事件類型</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logRows.map(row => (
                <TableRow key={row.id} sx={row.status === 'fail' || row.status === 'warning' ? { bgcolor: 'warning.lighter' } : {}}>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell>{row.ip}</TableCell>
                  <TableCell>
                    {row.type === 'login' ? '登入' : row.type === 'logout' ? '登出' : row.type === 'abnormal' ? '異常' : row.type === 'role' ? '權限變更' : '資料操作'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.status === 'success' ? '成功' : row.status === 'fail' ? '失敗' : row.status === 'warning' ? '警告' : ''}
                      color={row.status === 'success' ? 'success' : row.status === 'fail' ? 'error' : row.status === 'warning' ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{row.desc}</TableCell>
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
