"use client";
import React from 'react';
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
    Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon
} from '@mui/icons-material';

const RateTableManager = ({ onRateTableSelect, selectedRateTable }) => {
    // 模擬費率表數據
    const rateTables = [
        { id: 0, name: '2024年夏季費率表', date: '2024-06-01', isActive: true },
        { id: 1, name: '2024年冬季費率表', date: '2024-12-01', isActive: false },
        { id: 2, name: '2023年夏季費率表', date: '2023-06-01', isActive: false },
        { id: 3, name: '2023年冬季費率表', date: '2023-12-01', isActive: false },
        { id: 4, name: '2022年夏季費率表', date: '2022-06-01', isActive: false },
    ];

    const handleAddRateTable = () => {
        // 處理新增費率表的邏輯
        console.log('新增費率表');
    };

    const handleDeleteRateTable = (id) => {
        // 處理刪除費率表的邏輯
        console.log('刪除費率表:', id);
    };

    const handleEditRateTable = (id) => {
        // 處理編輯費率表的邏輯
        console.log('編輯費率表:', id);
    };

    return (
        <Paper 
            sx={{ 
                width: 320, 
                borderRight: 1, 
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh'
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
                    費率表管理
                </Typography>
                <Tooltip title="新增費率表">
                    <IconButton 
                        onClick={handleAddRateTable}
                        color="primary"
                        size="small"
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* 費率表列表 */}
            <List sx={{ flex: 1, overflow: 'auto' }}>
                {rateTables.map((rateTable, index) => (
                    <React.Fragment key={rateTable.id}>
                        <ListItem 
                            disablePadding
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title="編輯">
                                        <IconButton 
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditRateTable(rateTable.id);
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
                                                handleDeleteRateTable(rateTable.id);
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
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" component="span">
                                                {rateTable.name}
                                            </Typography>
                                            {rateTable.isActive && (
                                                <Box
                                                    sx={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        backgroundColor: 'success.main',
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            建立日期: {rateTable.date}
                                        </Typography>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                        {index < rateTables.length - 1 && <Divider />}
                    </React.Fragment>
                ))}
            </List>
        </Paper>
    );
};

export default RateTableManager; 