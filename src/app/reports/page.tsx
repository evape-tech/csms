"use client";
import React, { useState, useCallback, memo, lazy, Suspense, useMemo, useEffect } from 'react';
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
  Avatar,
  Button,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import InsightsIcon from '@mui/icons-material/Insights';

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
          bgcolor: alpha(theme.palette.background.paper, 0.6)
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

const SUMMARY_DEFAULT = {
  charging: { count: 0, today: 0 },
  transactions: { count: 0, today: 0 },
  system: { count: 0, today: 0 },
  usage: { count: 0, today: 0 }
};

interface SummaryCardProps {
  title: string;
  value: number;
  delta: number;
  icon: React.ReactNode;
  color: string;
}

const SummaryCard = memo(function SummaryCard({ title, value, delta, icon, color }: SummaryCardProps) {
  const theme = useTheme();

  return (
    <Card
      elevation={2}
      sx={{
        borderRadius: 3,
        bgcolor: alpha(color, 0.05),
        border: `1px solid ${alpha(color, 0.12)}`,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[6],
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: color,
              color: theme.palette.getContrastText(color),
              width: 48,
              height: 48,
              mr: 2
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: color, lineHeight: 1 }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          今日新增 {delta.toLocaleString()} 筆
        </Typography>
      </CardContent>
    </Card>
  );
});

const Reports = memo(function Reports() {
  const theme = useTheme();
  const [value, setValue] = useState(0);

  const handleChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  const [summary, setSummary] = useState(SUMMARY_DEFAULT);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const response = await fetch('/api/reports/summary', {
        cache: 'no-store'
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || '無法取得報表摘要');
      }

      const normalize = (section?: { count?: number; today?: number }) => ({
        count: section?.count ?? 0,
        today: section?.today ?? 0
      });

      setSummary({
        charging: normalize(json.data?.charging),
        transactions: normalize(json.data?.transactions),
        system: normalize(json.data?.system),
        usage: normalize(json.data?.usage)
      });
    } catch (error) {
      console.error('Fetch report summary error:', error);
      setSummaryError(error instanceof Error ? error.message : '未知錯誤，請稍後再試');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const summaryCards = useMemo(() => ([
    {
      key: 'charging',
      title: '充電記錄總數',
      value: summary.charging.count,
      delta: summary.charging.today,
      icon: <ElectricBoltIcon />,
      color: theme.palette.primary.main
    },
    {
      key: 'transactions',
      title: '交易記錄總數',
      value: summary.transactions.count,
      delta: summary.transactions.today,
      icon: <ReceiptIcon />,
      color: theme.palette.success.main
    },
    {
      key: 'system',
      title: '系統記錄總數',
      value: summary.system.count,
      delta: summary.system.today,
      icon: <SettingsIcon />,
      color: theme.palette.warning.main
    },
    {
      key: 'usage',
      title: '使用記錄總數',
      value: summary.usage.count,
      delta: summary.usage.today,
      icon: <AnalyticsIcon />,
      color: theme.palette.info.main
    }
  ]), [summary, theme]);

  const aggregatedStats = useMemo(() => summaryCards.reduce((acc, stat) => ({
    total: acc.total + stat.value,
    today: acc.today + stat.delta
  }), { total: 0, today: 0 }), [summaryCards]);

  const handleExport = useCallback(() => {
    console.info('Export reports requested');
  }, []);

  const handleRefresh = useCallback(() => {
    fetchSummary();
  }, [fetchSummary]);

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
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box>
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
              報表管理中心
            </Typography>
            <Typography variant="body1" color="text.secondary">
              掌握充電、交易、系統與使用記錄的完整分析資訊
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              flexWrap: 'wrap',
              '& > *': { flexShrink: 0 }
            }}
          >
            <Chip
              icon={<InsightsIcon />}
              label={summaryLoading ? '摘要載入中…' : `今日新增報表 ${aggregatedStats.today.toLocaleString()} 筆`}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
                fontWeight: 600
              }}
            />
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              sx={{
                px: 3,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
              onClick={handleExport}
              disabled={summaryLoading}
            >
              匯出報表
            </Button>
            <Button
              variant="outlined"
              startIcon={summaryLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              sx={{
                px: 3,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
              onClick={handleRefresh}
              disabled={summaryLoading}
            >
              更新數據
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* 統計概覽 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theme.palette.text.primary }}>
          報表統計概覽
        </Typography>
        {summaryError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {summaryError}
          </Alert>
        )}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            '& > *': {
              flex: '1 1 280px',
              minWidth: 240
            }
          }}
        >
          {summaryCards.map(({ key, title, value, delta, icon, color }) => (
            <SummaryCard
              key={key}
              title={title}
              value={value}
              delta={delta}
              icon={icon}
              color={color}
            />
          ))}
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