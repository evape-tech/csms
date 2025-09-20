"use client";
import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Divider,
    Tooltip,
    IconButton,
    Alert,
    Stack,
    Paper
} from '@mui/material';
import {
    Info as InfoIcon,
    Star as StarIcon,
    Power as PowerIcon,
    PowerOff as PowerOffIcon,
    Schedule as ScheduleIcon,
    TrendingUp as TrendingUpIcon,
    LocalOffer as LocalOfferIcon,
    AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';

interface TariffDetailCardProps {
    tariff: any | null;
    loading?: boolean;
}

const TariffDetailCard: React.FC<TariffDetailCardProps> = ({ tariff, loading = false }) => {
    if (loading) {
        return (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent>
                    <Box textAlign="center" py={4}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            載入中...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            正在載入費率方案資料
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (!tariff) {
        return (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent>
                    <Box textAlign="center" py={4}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            請選擇一個費率方案
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            從左側選單中選擇要查看的費率方案
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    const getTariffTypeLabel = (type: string) => {
        const typeMap: Record<string, string> = {
            'FIXED_RATE': '固定費率',
            'TIME_OF_USE': '時間電價',
            'PROGRESSIVE': '累進費率',
            'SPECIAL_PROMOTION': '特殊優惠',
            'MEMBERSHIP': '會員專屬',
            'CUSTOM': '自訂費率'
        };
        return typeMap[type] || type;
    };

    const getTariffTypeIcon = (type: string) => {
        const iconMap: Record<string, React.ReactElement> = {
            'FIXED_RATE': <AccountBalanceIcon />,
            'TIME_OF_USE': <ScheduleIcon />,
            'PROGRESSIVE': <TrendingUpIcon />,
            'SPECIAL_PROMOTION': <LocalOfferIcon />,
            'MEMBERSHIP': <StarIcon />,
            'CUSTOM': <InfoIcon />
        };
        return iconMap[type] || <InfoIcon />;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '未設定';
        return new Date(dateString).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price: any) => {
        if (price === null || price === undefined) return '未設定';
        return `$${Number(price).toFixed(2)}`;
    };

    const formatTime = (timeString: string | null) => {
        if (!timeString) return '未設定';
        return timeString;
    };

    return (
        <Card sx={{ height: '100%', overflow: 'auto' }}>
            <CardContent>
                {/* 標題區域 */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getTariffTypeIcon(tariff.tariff_type)}
                            <Typography variant="h5" component="h1">
                                {tariff.name}
                            </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {tariff.is_default && (
                                <Tooltip title="這是預設的費率方案">
                                    <Chip
                                        icon={<StarIcon />}
                                        label="預設方案"
                                        color="warning"
                                        size="small"
                                    />
                                </Tooltip>
                            )}
                            
                            <Tooltip title={tariff.is_active ? "此方案目前啟用中" : "此方案已停用"}>
                                <Chip
                                    icon={tariff.is_active ? <PowerIcon /> : <PowerOffIcon />}
                                    label={tariff.is_active ? '啟用中' : '已停用'}
                                    color={tariff.is_active ? 'success' : 'default'}
                                    size="small"
                                />
                            </Tooltip>
                            
                            <Chip
                                label={getTariffTypeLabel(tariff.tariff_type)}
                                color="primary"
                                variant="outlined"
                                size="small"
                            />
                        </Box>
                    </Box>

                    {tariff.description && (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            {tariff.description}
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* 基本價格資訊 */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceIcon color="primary" />
                        基本價格資訊
                        <Tooltip title="這些是基本的收費標準">
                            <IconButton size="small">
                                <InfoIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Typography>
                    
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                基本電價
                            </Typography>
                            <Typography variant="h6" color="primary">
                                {formatPrice(tariff.base_price)} / kWh
                            </Typography>
                        </Paper>
                        
                        {tariff.charging_parking_fee && (
                            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    充電期間停車費
                                </Typography>
                                <Typography variant="h6">
                                    {formatPrice(tariff.charging_parking_fee)}
                                </Typography>
                            </Paper>
                        )}
                    </Stack>
                </Box>

                {/* 時間電價設定 */}
                {tariff.tariff_type === 'TIME_OF_USE' && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ScheduleIcon color="primary" />
                            時間電價設定
                            <Tooltip title="依據不同時段收取不同費率">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                        
                        <Stack spacing={2}>
                            <Alert severity="info">
                                尖峰時段：{formatTime(tariff.peak_hours_start)} - {formatTime(tariff.peak_hours_end)}
                            </Alert>
                            
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        尖峰電價
                                    </Typography>
                                    <Typography variant="h6" color="error">
                                        {formatPrice(tariff.peak_hours_price)} / kWh
                                    </Typography>
                                </Paper>
                                
                                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        離峰電價
                                    </Typography>
                                    <Typography variant="h6" color="success">
                                        {formatPrice(tariff.off_peak_price)} / kWh
                                    </Typography>
                                </Paper>
                                
                                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        週末電價
                                    </Typography>
                                    <Typography variant="h6">
                                        {formatPrice(tariff.weekend_price)} / kWh
                                    </Typography>
                                </Paper>
                            </Stack>
                        </Stack>
                    </Box>
                )}

                {/* 累進費率設定 */}
                {tariff.tariff_type === 'PROGRESSIVE' && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon color="primary" />
                            累進費率設定
                            <Tooltip title="用電量越多，單價越高">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                        
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    第一階段 (0 - {tariff.tier1_max_kwh || 0} kWh)
                                </Typography>
                                <Typography variant="h6" color="success">
                                    {formatPrice(tariff.tier1_price)} / kWh
                                </Typography>
                            </Paper>
                            
                            <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    第二階段 ({tariff.tier1_max_kwh || 0} - {tariff.tier2_max_kwh || 0} kWh)
                                </Typography>
                                <Typography variant="h6" color="warning">
                                    {formatPrice(tariff.tier2_price)} / kWh
                                </Typography>
                            </Paper>
                            
                            <Paper elevation={1} sx={{ p: 2, flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    第三階段 ({tariff.tier2_max_kwh || 0}+ kWh)
                                </Typography>
                                <Typography variant="h6" color="error">
                                    {formatPrice(tariff.tier3_price)} / kWh
                                </Typography>
                            </Paper>
                        </Stack>
                    </Box>
                )}

                {/* 特殊優惠設定 */}
                {tariff.tariff_type === 'SPECIAL_PROMOTION' && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocalOfferIcon color="primary" />
                            優惠資訊
                            <Tooltip title="限時特殊優惠方案">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                        
                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                {tariff.discount_percentage && (
                                    <Alert severity="success" sx={{ flex: 1 }}>
                                        <Typography variant="h6">
                                            折扣 {tariff.discount_percentage}%
                                        </Typography>
                                    </Alert>
                                )}
                                
                                {tariff.promotion_code && (
                                    <Paper elevation={1} sx={{ p: 2, textAlign: 'center', flex: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            優惠代碼
                                        </Typography>
                                        <Typography variant="h6" color="primary">
                                            {tariff.promotion_code}
                                        </Typography>
                                    </Paper>
                                )}
                            </Stack>
                            
                            <Alert severity="info">
                                <Typography variant="body2">
                                    優惠期限：{formatDate(tariff.valid_from)} - {formatDate(tariff.valid_to)}
                                </Typography>
                            </Alert>
                        </Stack>
                    </Box>
                )}

                {/* 適用條件 */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InfoIcon color="primary" />
                        適用條件
                    </Typography>
                    
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {tariff.membership_required && (
                            <Tooltip title="僅限會員使用此費率方案">
                                <Chip
                                    label="需要會員資格"
                                    color="secondary"
                                    size="small"
                                />
                            </Tooltip>
                        )}
                        
                        {tariff.ac_only && (
                            <Tooltip title="僅適用於 AC 交流充電">
                                <Chip
                                    label="僅 AC 充電"
                                    color="info"
                                    size="small"
                                />
                            </Tooltip>
                        )}
                        
                        {tariff.dc_only && (
                            <Tooltip title="僅適用於 DC 直流快充">
                                <Chip
                                    label="僅 DC 快充"
                                    color="warning"
                                    size="small"
                                />
                            </Tooltip>
                        )}
                        
                        {!tariff.ac_only && !tariff.dc_only && (
                            <Tooltip title="適用於所有充電類型">
                                <Chip
                                    label="AC / DC 皆適用"
                                    color="success"
                                    size="small"
                                />
                            </Tooltip>
                        )}
                    </Stack>
                </Box>

                {/* 建立資訊 */}
                <Divider sx={{ mb: 2 }} />
                <Box>
                    <Typography variant="body2" color="text.secondary">
                        建立時間：{formatDate(tariff.createdAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        更新時間：{formatDate(tariff.updatedAt)}
                    </Typography>
                    {tariff.created_by && (
                        <Typography variant="body2" color="text.secondary">
                            建立者：{tariff.created_by}
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default TariffDetailCard;
