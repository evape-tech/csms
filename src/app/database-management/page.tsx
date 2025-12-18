'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Alert, 
  Chip,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid
} from '@mui/material';
import { 
  Storage as DatabaseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  SwapHoriz as SwitchIcon
} from '@mui/icons-material';

interface DatabaseStats {
  provider?: string;
  isConnected?: boolean;
  timestamp?: string;
  counts?: {
    guns?: number;
    users?: number;
    cpLogs?: number;
    error?: string;
  };
  error?: string;
}

interface ConnectionTest {
  mysql: boolean;
}

export default function DatabaseManagementPage() {
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [stats, setStats] = useState<DatabaseStats>({});
  const [connectionTests, setConnectionTests] = useState<ConnectionTest>({ mysql: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // 獲取數據庫狀態
  const fetchDatabaseStats = async () => {
    try {
      const response = await fetch('/api/database');
      const data = await response.json();
      setStats(data);
      if (data.provider) {
        setCurrentProvider(data.provider);
      }
    } catch (err) {
      setError('Failed to fetch database stats');
    }
  };

  // 測試所有連接
  const testAllConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' })
      });
      const data = await response.json();
      setConnectionTests(data);
    } catch (err) {
      setError('Failed to test connections');
    } finally {
      setLoading(false);
    }
  };

  // 切換數據庫
  const switchDatabase = async (provider: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', provider })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`Successfully switched to ${provider.toUpperCase()}`);
        setCurrentProvider(provider);
        await fetchDatabaseStats();
      } else {
        setError(data.error || 'Failed to switch database');
      }
    } catch (err) {
      setError('Failed to switch database');
    } finally {
      setLoading(false);
    }
  };

  // 健康檢查
  const healthCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'healthCheck' })
      });
      const data = await response.json();
      setStats(prev => ({ ...prev, isConnected: data.healthy }));
    } catch (err) {
      setError('Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
    testAllConnections();
  }, []);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <DatabaseIcon /> Database Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 當前狀態 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Database Status
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="subtitle1">Provider:</Typography>
                <Chip 
                  label={currentProvider.toUpperCase() || 'Unknown'} 
                  color={currentProvider ? 'primary' : 'default'}
                  variant="outlined"
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="subtitle1">Status:</Typography>
                <Chip 
                  icon={stats.isConnected ? <CheckIcon /> : <ErrorIcon />}
                  label={stats.isConnected ? 'Connected' : 'Disconnected'} 
                  color={stats.isConnected ? 'success' : 'error'}
                />
              </Box>

              {stats.timestamp && (
                <Typography variant="body2" color="text.secondary">
                  Last checked: {new Date(stats.timestamp).toLocaleString('zh-TW', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Typography>
              )}

              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<RefreshIcon />}
                  onClick={fetchDatabaseStats}
                  disabled={loading}
                  sx={{ mr: 1 }}
                >
                  Refresh
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={healthCheck}
                  disabled={loading}
                >
                  Health Check
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 數據統計 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Database Statistics
              </Typography>
              
              {stats.counts && !stats.counts.error ? (
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Charging Guns" 
                      secondary={stats.counts.guns || 0} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Users" 
                      secondary={stats.counts.users || 0} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="CP Logs" 
                      secondary={stats.counts.cpLogs || 0} 
                    />
                  </ListItem>
                </List>
              ) : (
                <Typography color="text.secondary">
                  {stats.counts?.error || 'No data available'}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 連接測試 */}
      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connection Tests
            </Typography>
              
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <DatabaseIcon />
                  <Typography variant="subtitle1">MySQL</Typography>
                  <Chip 
                    icon={connectionTests.mysql ? <CheckIcon /> : <ErrorIcon />}
                    label={connectionTests.mysql ? 'Available' : 'Unavailable'} 
                    color={connectionTests.mysql ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Grid>
              {/* MSSQL support removed */}
            </Grid>

            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />}
              onClick={testAllConnections}
              disabled={loading}
            >
              Test All Connections
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* 數據庫切換 */}
      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Switch Database
            </Typography>
              
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The application uses MySQL as the single supported database. You can ensure the MySQL connection here.
            </Typography>

              <Grid container spacing={2}>
              <Grid>
                <Button
                  variant={currentProvider === 'mysql' ? 'contained' : 'outlined'}
                  startIcon={<SwitchIcon />}
                  onClick={() => switchDatabase('mysql')}
                  disabled={loading || currentProvider === 'mysql' || !connectionTests.mysql}
                  fullWidth
                  sx={{ height: 60 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Ensure MySQL Connection'}
                </Button>
              </Grid>
            </Grid>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
