"use client";
import React, {useState, useMemo} from "react";
import {
    Card,
    CardContent,
    Tabs,
    Tab,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Typography,
    useTheme,
    Skeleton,
    Alert,
    Chip
} from "@mui/material";

const ElectricityRateTableCard = ({ tariff = null, loading = false }) => {
    const [activeTab, setActiveTab] = useState(0); // 0 for rate, 1 for calendar
    const theme = useTheme();
    const [currentMonthOffset, setCurrentMonthOffset] = useState(0); // 0 = this month, -1 prev, +1 next
    const [showAllMonths, setShowAllMonths] = useState(false);

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

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    // memoize static rate table to avoid re-render on tab switches / month navigation
    const rateTable = useMemo(() => (
        <TableContainer component={Paper} sx={{ overflowX: 'auto', boxShadow: 'none' }} elevation={0}>
            <Table sx={{ minWidth: 1200 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ borderLeft: `1px solid ${theme.palette.divider}`, borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }} colSpan={5}>時段</TableCell>
                        <TableCell sx={{ borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }}></TableCell>
                        <TableCell sx={{ borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }}></TableCell>
                        <TableCell sx={{ borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }}></TableCell>
                        <TableCell sx={{ borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}` }}></TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>夏日<br />06-01 ~ 09-30</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>非夏日</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} rowSpan={10}>流動電費</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} rowSpan={5}>週一至週五</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} rowSpan={2}>尖峰時段</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>夏日</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>07:30 - 22:30</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}`, textAlign: 'center' }} colSpan={4} rowSpan={10}>每度</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>6.42</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>非夏日</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>07:30 - 22:30</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>6.41</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} rowSpan={2}>半尖峰</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>夏日</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>非夏日</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} colSpan={2}>離峰</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>00:00 - 07:30<br />22:30 - 24:00</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.81</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.8</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} rowSpan={2}>週六</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} colSpan={2}>半尖峰</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>--</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} colSpan={2}>離峰</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>00:00 - 24:00</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.8</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.81</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>週日&國定假日</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }} colSpan={2}>離峰</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>00:00 - 24:00</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.8</TableCell>
                        <TableCell sx={{ border: `1px solid ${theme.palette.divider}` }}>3.8</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    ), [theme.palette.divider, theme.palette.primary.main, theme.palette.text.primary, theme.palette.text.secondary]);

    // ---------- Calendar performance: compute grids at top-level with hooks ----------
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    const monthToRender = useMemo(() => {
        if (showAllMonths) return Array.from({length: 12}, (_, i) => i);
        return [((todayMonth + currentMonthOffset) % 12 + 12) % 12];
    }, [showAllMonths, currentMonthOffset, todayMonth]);

    const calculateMonthGrid = (year, monthIndex) => {
        const firstOfMonth = new Date(year, monthIndex, 1);
        const firstWeekday = firstOfMonth.getDay();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        const cells = new Array(42).fill(null).map((_, idx) => {
            const dayNumber = idx - firstWeekday + 1;
            return dayNumber < 1 || dayNumber > daysInMonth ? null : dayNumber;
        });

        const weeks = [];
        for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
        return weeks;
    };

    const weeksMap = useMemo(() => {
        const map = {};
        monthToRender.forEach(m => {
            map[m] = calculateMonthGrid(currentYear, m);
        });
        return map;
    }, [monthToRender, currentYear]);

    const renderCalendar = () => {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

        const renderMonthCalendar = (monthIndex) => {
            const weeks = weeksMap[monthIndex] || calculateMonthGrid(currentYear, monthIndex);

            return (
                <Box key={monthIndex} sx={{ marginBottom: '1rem' }}>
                    <Typography
                        variant="h6"
                        sx={{
                            textAlign: 'center',
                            marginBottom: '0.5rem',
                            color: monthIndex === todayMonth
                                ? theme.palette.primary.main
                                : theme.palette.text.primary
                        }}
                    >
                        {monthNames[monthIndex]}
                    </Typography>
                    <Table sx={{ width: '100%', fontSize: '0.75rem' }}>
                        <TableHead>
                            <TableRow>
                                {weekDays.map(day => (
                                    <TableCell
                                        key={day}
                                        sx={{
                                            border: 'none',
                                            padding: '0.25rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold',
                                            color: theme.palette.text.secondary
                                        }}
                                    >
                                        {day}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {weeks.map((week, weekIndex) => (
                                <TableRow key={weekIndex}>
                                    {week.map((d, i) => {
                                        if (!d) return <TableCell key={i} sx={{ border: 'none', padding: '0.25rem' }} />;
                                        const isWeekend = (i === 0 || i === 6);
                                        const isToday = monthIndex === todayMonth && d === todayDay;
                                        return (
                                            <TableCell key={i} sx={{ border: 'none', padding: '0.25rem', textAlign: 'center' }}>
                                                <Box
                                                    sx={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: isToday
                                                            ? theme.palette.primary.main
                                                            : isWeekend
                                                                ? theme.palette.grey[700]
                                                                : 'transparent',
                                                        color: isToday
                                                            ? theme.palette.primary.contrastText
                                                            : isWeekend
                                                                ? theme.palette.grey[300]
                                                                : theme.palette.text.primary,
                                                        fontWeight: isToday ? 'bold' : 'normal',
                                                        fontSize: '0.75rem',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {d}
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            );
        };

        return (
            <Box>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
                    <Button size="small" onClick={() => setCurrentMonthOffset(o => o - 1)}>上個月</Button>
                    <Button size="small" onClick={() => setCurrentMonthOffset(0)}>本月</Button>
                    <Button size="small" onClick={() => setCurrentMonthOffset(o => o + 1)}>下個月</Button>
                    <Button size="small" onClick={() => setShowAllMonths(s => !s)}>{showAllMonths ? '只顯示本月' : '顯示全部月份'}</Button>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: showAllMonths ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
                    {monthToRender.map(m => renderMonthCalendar(m))}
                </Box>
            </Box>
        );
    };

     return (
         <Card sx={{ margin: '1rem 0', boxShadow: 'none' }} elevation={0}>
             <CardContent>
                 {/* 費率方案資訊 */}
                 {loading ? (
                     <Box sx={{ mb: 3 }}>
                         <Skeleton variant="text" width="40%" height={32} />
                         <Skeleton variant="text" width="60%" height={20} />
                         <Skeleton variant="text" width="30%" height={20} />
                     </Box>
                 ) : tariff ? (
                     <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                             <Typography variant="h5" component="h2">
                                 {tariff.name}
                             </Typography>
                             <Chip 
                                 label={getTariffTypeLabel(tariff.tariff_type)} 
                                 color="primary" 
                                 variant="outlined"
                                 size="small"
                             />
                             {tariff.is_default && (
                                 <Chip 
                                     label="預設方案" 
                                     color="warning" 
                                     size="small"
                                 />
                             )}
                             {!tariff.is_active && (
                                 <Chip 
                                     label="停用" 
                                     color="default" 
                                     size="small"
                                 />
                             )}
                         </Box>
                         {tariff.description && (
                             <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                 {tariff.description}
                             </Typography>
                         )}
                         <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                             <Typography variant="body2">
                                 <strong>基本價格:</strong> ${tariff.base_price}/kWh
                             </Typography>
                             {tariff.charging_parking_fee && (
                                 <Typography variant="body2">
                                     <strong>充電期間停車費:</strong> ${tariff.charging_parking_fee}
                                 </Typography>
                             )}
                             <Typography variant="body2">
                                 <strong>建立時間:</strong> {formatDate(tariff.created_at)}
                             </Typography>
                         </Box>
                     </Box>
                 ) : (
                     <Alert severity="info" sx={{ mb: 3 }}>
                         請選擇一個費率方案以查看詳細資訊
                     </Alert>
                 )}

                 <Tabs 
                     value={activeTab} 
                     onChange={handleTabChange}
                     sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: 2 }}
                 >
                     <Tab label="費率表" />
                     <Tab label="尖離峰" />
                 </Tabs>

                 {activeTab === 0 ? rateTable : renderCalendar()}

                 <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem' }}>
                     <Button 
                         variant="contained" 
                         color="error"
                         size="small"
                         disabled={!tariff}
                     >
                         刪除
                     </Button>
                     <Button 
                         variant="contained" 
                         color="primary"
                         size="small"
                         disabled={!tariff}
                     >
                         編輯
                     </Button>
                 </Box>
             </CardContent>
         </Card>
     );
 };

 export default ElectricityRateTableCard;
