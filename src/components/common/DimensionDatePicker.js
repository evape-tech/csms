import React from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const DimensionDatePicker = ({ startDate, endDate, dimension, onStartDateChange, onEndDateChange, onDimensionChange, showDimension = true }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
    <TextField
      type="date"
      size="small"
      label="開始日期"
      value={startDate}
      onChange={e => onStartDateChange(e.target.value)}
      sx={{ minWidth: 130, mr: 1 }}
      InputLabelProps={{ shrink: true }}
    />
    <span style={{ margin: '0 4px' }}>~</span>
    <TextField
      type="date"
      size="small"
      label="結束日期"
      value={endDate}
      onChange={e => onEndDateChange(e.target.value)}
      sx={{ minWidth: 130, mr: showDimension ? 2 : 0 }}
      InputLabelProps={{ shrink: true }}
    />
    {showDimension && (
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel id="dimension-label">維度</InputLabel>
        <Select
          labelId="dimension-label"
          value={dimension}
          label="維度"
          onChange={e => onDimensionChange(e.target.value)}
        >
          <MenuItem value="日">每日</MenuItem>
          <MenuItem value="週">每週</MenuItem>
          <MenuItem value="月">每月</MenuItem>
          <MenuItem value="年">每年</MenuItem>
        </Select>
      </FormControl>
    )}
  </Box>
);

export default DimensionDatePicker;
