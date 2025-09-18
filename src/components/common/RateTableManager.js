"use client";
import React, { useState, useEffect } from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Divider,
    Typography,
    Paper,
    IconButton,
    Tooltip,
    Chip,
    Alert
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Star as StarIcon
} from '@mui/icons-material';
import TariffDialog from '../dialog/TariffDialog';
import { getTariffs, deleteTariff } from '../../actions/tariffActions';

const RateTableManager = ({ onRateTableSelect, selectedRateTable }) => {
    const [tariffs, setTariffs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTariff, setEditingTariff] = useState(null);

    // 載入費率資料
    const loadTariffs = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getTariffs();
            if (result.success) {
                setTariffs(result.data);
            } else {
                setError(result.error || '載入費率資料失敗');
            }
        } catch (err) {
            setError('載入費率資料時發生錯誤');
            console.error('Error loading tariffs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTariffs();
    }, []);

    const handleAddRateTable = () => {
        setEditingTariff(null);
        setDialogOpen(true);
    };

    const handleDeleteRateTable = async (id) => {
        if (window.confirm('確定要刪除這個費率方案嗎？此操作無法復原。')) {
            try {
                const result = await deleteTariff(id);
                if (result.success) {
                    await loadTariffs(); // 重新載入資料
                } else {
                    alert(result.error || '刪除失敗');
                }
            } catch (err) {
                alert('刪除時發生錯誤');
                console.error('Error deleting tariff:', err);
            }
        }
    };

    const handleEditRateTable = (tariff) => {
        setEditingTariff(tariff);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setEditingTariff(null);
    };

    const handleDialogSuccess = () => {
        setDialogOpen(false);
        setEditingTariff(null);
        loadTariffs(); // 重新載入資料
    };

    const getTariffTypeLabel = (type) => {
        const typeMap = {
            'FIXED_RATE': '固定費率',
            'TIME_OF_USE': '時間電價',
            'PROGRESSIVE': '累進費率',
            'SPECIAL_PROMOTION': '特殊優惠'
        };
        return typeMap[type] || type;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('zh-TW');
    };

    return (
        <>
            <Paper 
                sx={{ 
                    width: 320, 
                    borderRight: 1, 
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh', // 固定視窗高度
                    overflow: 'hidden' // 防止整個 Paper 滾動
                }}
                elevation={0}
            >
                {/* 標題區域 */}
                <Box sx={{ 
                    p: 2, 
                    borderBottom: 1, 
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Typography variant="h6" component="h2">
                        費率方案管理
                    </Typography>
                    <Tooltip title="新增費率方案">
                        <IconButton 
                            onClick={handleAddRateTable}
                            color="primary"
                            size="small"
                        >
                            <AddIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* 錯誤訊息 */}
                {error && (
                    <Box sx={{ p: 2 }}>
                        <Alert severity="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    </Box>
                )}

                {/* 費率表列表 */}
                <List sx={{ 
                    flex: 1, 
                    overflow: 'auto', // 只有列表區域可以滾動
                    height: 0 // 強制 flex 計算高度
                }}>
                    {loading ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                載入中...
                            </Typography>
                        </Box>
                    ) : tariffs.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                暫無費率方案資料
                            </Typography>
                        </Box>
                    ) : (
                        tariffs.map((tariff, index) => (
                            <React.Fragment key={tariff.id}>
                                <ListItem 
                                    disablePadding
                                    secondaryAction={
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Tooltip title="編輯">
                                                <IconButton 
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditRateTable(tariff);
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="刪除">
                                                <IconButton 
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteRateTable(tariff.id);
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                >
                                    <ListItemButton
                                        selected={selectedRateTable === index}
                                        onClick={() => onRateTableSelect(index)}
                                        sx={{
                                            '&.Mui-selected': {
                                                backgroundColor: 'primary.light',
                                                '&:hover': {
                                                    backgroundColor: 'primary.light',
                                                },
                                            },
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Typography variant="body2" component="span">
                                                        {tariff.name}
                                                    </Typography>
                                                    {tariff.is_default && (
                                                        <Tooltip title="預設費率方案">
                                                            <StarIcon 
                                                                fontSize="small" 
                                                                sx={{ color: 'warning.main' }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    {!tariff.is_active && (
                                                        <Chip 
                                                            label="停用" 
                                                            size="small" 
                                                            color="default"
                                                            sx={{ fontSize: '0.7rem', height: 18 }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        類型: {getTariffTypeLabel(tariff.tariff_type)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        基本價格: ${tariff.base_price}/kWh
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        建立時間: {formatDate(tariff.created_at)}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                                {index < tariffs.length - 1 && <Divider />}
                            </React.Fragment>
                        ))
                    )}
                </List>
            </Paper>

            {/* 費率方案對話框 */}
            <TariffDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSuccess={handleDialogSuccess}
                editingTariff={editingTariff}
            />
        </>
    );
};

export default RateTableManager; 