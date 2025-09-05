"use client";
import React, { useState, useCallback, memo, lazy, Suspense } from 'react';
import {
  Tabs,
  Tab,
  Box,
  Paper,
  Container,
  Typography,
  CircularProgress,
  useTheme,
  alpha,
  Card,
  CardContent,
  Avatar
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Analytics';

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
  const theme = useTheme();
console.log("Server render at:", new Date().toISOString());
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{
          p: 4,
          minHeight: 400,
          bgcolor: alpha(theme.palette.background.default, 0.3)
        }}>
          <Suspense fallback={
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              py={8}
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                borderRadius: 3,
                backdropFilter: 'blur(10px)'
              }}
            >
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                載入中...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                正在準備報表數據
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
  const theme = useTheme();

  return (
    <Box sx={{
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      px: 3,
      py: 1,
      bgcolor: alpha(theme.palette.background.paper, 0.8),
      backdropFilter: 'blur(10px)'
    }}>
      <Tabs
        value={value}
        onChange={onChange}
        aria-label="報表類型"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minWidth: 140,
            fontWeight: 600,
            fontSize: '0.95rem',
            textTransform: 'none',
            borderRadius: 2,
            mx: 0.5,
            py: 1.5,
            px: 3,
            minHeight: 48,
            color: theme.palette.text.secondary,
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              fontWeight: 700
            },
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              color: theme.palette.primary.main
            },
            transition: 'all 0.2s ease-in-out'
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: 2,
            bgcolor: theme.palette.primary.main
          }
        }}
      >
        <Tab
          icon={<ElectricBoltIcon sx={{ fontSize: '1.2rem' }} />}
          iconPosition="start"
          label="充電紀錄"
          {...a11yProps(0)}
        />
        <Tab
          icon={<ReceiptIcon sx={{ fontSize: '1.2rem' }} />}
          iconPosition="start"
          label="交易紀錄"
          {...a11yProps(1)}
        />
        <Tab
          icon={<SettingsIcon sx={{ fontSize: '1.2rem' }} />}
          iconPosition="start"
          label="系統紀錄"
          {...a11yProps(2)}
        />
        <Tab
          icon={<AnalyticsIcon sx={{ fontSize: '1.2rem' }} />}
          iconPosition="start"
          label="使用紀錄"
          {...a11yProps(3)}
        />
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
  const theme = useTheme();
  const [value, setValue] = useState(0);

  const handleChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  // 報表統計數據
  const reportStats = {
    charging: { count: 1247, today: 89 },
    transactions: { count: 892, today: 45 },
    system: { count: 156, today: 12 },
    usage: { count: 2341, today: 156 }
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
          <AssessmentIcon sx={{ fontSize: '2rem' }} />
          報表管理系統
        </Typography>
        <Typography variant="body1" color="text.secondary">
          查看和管理各種系統報表和記錄數據
        </Typography>
      </Box>

      {/* 統計概覽 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.text.primary }}>
          報表統計概覽
        </Typography>
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          '& > *': { flex: '1 1 280px', minWidth: 240 }
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
                  <ElectricBoltIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    充電記錄總數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    lineHeight: 1
                  }}>
                    {reportStats.charging.count.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    今日新增: {reportStats.charging.today}
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
                  <ReceiptIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    交易記錄總數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.success.main,
                    lineHeight: 1
                  }}>
                    {reportStats.transactions.count.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    今日新增: {reportStats.transactions.today}
                  </Typography>
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
                  <SettingsIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    系統記錄總數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.warning.main,
                    lineHeight: 1
                  }}>
                    {reportStats.system.count.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    今日新增: {reportStats.system.today}
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
                  <AnalyticsIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    使用記錄總數
                  </Typography>
                  <Typography variant="h4" sx={{
                    fontWeight: 700,
                    color: theme.palette.info.main,
                    lineHeight: 1
                  }}>
                    {reportStats.usage.count.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    今日新增: {reportStats.usage.today}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Paper
        elevation={2}
        sx={{
          width: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
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