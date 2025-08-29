"use client";
import React, { useState, useCallback, memo, lazy, Suspense } from 'react';
import { Tabs, Tab, Box, Paper, Container, Typography, CircularProgress } from '@mui/material';

// 使用 lazy loading 加載組件
const ChargingRecords = lazy(() => import('./ChargingRecords'));
const TransactionRecords = lazy(() => import('./TransactionRecords'));
const SystemRecords = lazy(() => import('./SystemRecords'));
const UsageRecords = lazy(() => import('./UsageRecords'));

// 優化的 TabPanel 組件
const TabPanel = memo(function TabPanel(props: {
  children?: React.ReactNode;
  value: number;
  index: number;
  [key: string]: any
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          <Suspense fallback={
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                載入中...
              </Typography>
            </Box>
          }>
            {children}
          </Suspense>
        </Box>
      )}
    </div>
  );
});

TabPanel.displayName = 'TabPanel';

// 優化的 Tabs 組件
const ReportTabs = memo(function ReportTabs({
  value,
  onChange
}: {
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
}) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
      <Tabs
        value={value}
        onChange={onChange}
        aria-label="報表類型"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minWidth: 120,
            fontWeight: 500,
          }
        }}
      >
        <Tab label="充電紀錄" {...a11yProps(0)} />
        <Tab label="交易紀錄" {...a11yProps(1)} />
        <Tab label="系統紀錄" {...a11yProps(2)} />
        <Tab label="使用紀錄" {...a11yProps(3)} />
      </Tabs>
    </Box>
  );
});

ReportTabs.displayName = 'ReportTabs';

function a11yProps(index: number) {
  return {
    id: `reports-tab-${index}`,
    'aria-controls': `reports-tabpanel-${index}`,
  } as const;
}

const Reports = memo(function Reports() {
  const [value, setValue] = useState(0);

  const handleChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          報表管理
        </Typography>
        <Typography variant="body1" color="text.secondary">
          查看和管理各種系統報表和記錄
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }} elevation={2}>
        <ReportTabs value={value} onChange={handleChange} />

        <Box sx={{ p: 0 }}>
          <TabPanel value={value} index={0}>
            <ChargingRecords />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <TransactionRecords />
          </TabPanel>
          <TabPanel value={value} index={2}>
            <SystemRecords />
          </TabPanel>
          <TabPanel value={value} index={3}>
            <UsageRecords />
          </TabPanel>
        </Box>
      </Paper>
    </Container>
  );
});

Reports.displayName = 'Reports';

export default Reports;