"use client";
import React, { useState } from 'react';
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
  TableRow
} from '@mui/material';
import { DisclaimerFooter } from '@/components/layout';

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '啟用', value: 'active' },
  { label: '停用', value: 'disabled' },
];
const summary = { total: 2, active: 1, disabled: 1 };
const userRows = [
  { id: 1, name: '王小明', account: 'user1', email: 'user1@mail.com', phone: '0912345678', role: 'admin', status: 'active', created: '2024-05-01' },
  { id: 2, name: '李小華', account: 'user2', email: 'user2@mail.com', phone: '0922333444', role: 'user', status: 'active', created: '2024-05-03' },
  { id: 3, name: '張大明', account: 'user3', email: 'user3@mail.com', phone: '0933222111', role: 'user', status: 'disabled', created: '2024-05-10' },
];

export default function UserManagement() {
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  
  // 過濾掉管理員用戶
  const filteredUserRows = userRows.filter(row => row.role !== 'admin');
  
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
          <Button variant="contained">查詢</Button>
        </Stack>
      </Paper>
      {/* 統計概覽 */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
        <Box flex="1" minWidth={200}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">用戶總數</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.total}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth={200}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">啟用用戶</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.active}</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth={200}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">停用用戶</Typography>
              <Typography variant="h6" fontWeight="bold">{summary.disabled}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
      {/* 用戶列表表格 */}
      <Paper sx={{ p: 2 }}>
        <Typography fontWeight="bold" mb={1}>用戶列表</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell>
                <TableCell>帳號</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>權限</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>註冊日期</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUserRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.account}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>一般用戶</TableCell>
                  <TableCell>{row.status === 'active' ? '啟用' : '停用'}</TableCell>
                  <TableCell>{row.created}</TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined" sx={{ mr: 1 }}>編輯</Button>
                    <Button size="small" variant="outlined" color="warning" sx={{ mr: 1 }}>{row.status === 'active' ? '停用' : '啟用'}</Button>
                    <Button size="small" variant="outlined" color="info">重設密碼</Button>
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
