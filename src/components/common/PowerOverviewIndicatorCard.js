"use client";
import React, { useEffect, useState } from 'react';
import { Paper, Typography, Chip, Box, ListItemIcon } from '@mui/material';

export default function PowerOverviewIndicatorCard({ icon, label, value, valueUnit, chipLabel, valueColor = 'primary', iconColor = 'primary', minHeight = 120 }) {
  const [mounted, setMounted] = useState(false);
  const [clientChipLabel, setClientChipLabel] = useState(null);

  useEffect(() => {
    // postpone showing environment-dependent label until client mount
    setMounted(true);
    setClientChipLabel(chipLabel ?? null);
  }, [chipLabel]);

  return (
    <Paper elevation={2} sx={{ flex: 1, minHeight, p: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <ListItemIcon sx={{ justifyContent: 'center', mb: 0.2 }}>
        {React.cloneElement(icon, { sx: { color: `${iconColor}.main`, fontSize: '1.5rem' } })}
      </ListItemIcon>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <Typography variant="h5" color={valueColor} sx={{ fontWeight: 'bold', mb: 0, fontSize: '1.3rem' }}>
          {value} {valueUnit}
        </Typography>
        {mounted && clientChipLabel && (
          <Chip 
            label={clientChipLabel} 
            size="small" 
            color={valueColor}
            variant="outlined"
            sx={{ ml: 0.5, fontSize: '0.75rem', height: 22 }}
          />
        )}
      </Box>
    </Paper>
  );
}
