import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Switch,
  Box,
  Divider,
  Typography,
  Stack
} from '@mui/material';

interface Tariff {
  id: number;
  name: string;
  description?: string;
  tariff_type: string;
  base_price: number;
  service_fee?: number;
  minimum_fee?: number;
  peak_hours_start?: string;
  peak_hours_end?: string;
  peak_hours_price?: number;
  off_peak_price?: number;
  weekend_price?: number;
  tier1_max_kwh?: number;
  tier1_price?: number;
  tier2_max_kwh?: number;
  tier2_price?: number;
  tier3_price?: number;
  discount_percentage?: number;
  promotion_code?: string;
  valid_from?: string;
  valid_to?: string;
  ac_only: boolean;
  dc_only: boolean;
  membership_required: boolean;
  is_active: boolean;
  is_default: boolean;
  created_by?: string;
  createdAt: string;
  updatedAt: string;
}

interface TariffDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: globalThis.FormData) => Promise<void>;
  editingTariff: Tariff | null;
}

const tariffTypeOptions = [
  { value: 'FIXED_RATE', label: '固定費率' },
  { value: 'TIME_OF_USE', label: '時間電價' },
  { value: 'PROGRESSIVE', label: '累進費率' },
  { value: 'SPECIAL_PROMOTION', label: '特殊優惠' },
  { value: 'MEMBERSHIP', label: '會員費率' },
  { value: 'CUSTOM', label: '自訂費率' },
];

export default function TariffDialog({
  open,
  onClose,
  onSubmit,
  editingTariff
}: TariffDialogProps) {
  const [tariffType, setTariffType] = React.useState(editingTariff?.tariff_type || 'FIXED_RATE');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSubmit(formData);
  };

  const handleTariffTypeChange = (event: any) => {
    setTariffType(event.target.value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {editingTariff ? '編輯費率方案' : '新增費率方案'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 基本資訊 */}
            <Box>
              <Typography variant="h6" color="primary" gutterBottom>
                基本資訊
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  autoFocus
                  label="費率方案名稱"
                  name="name"
                  fullWidth
                  defaultValue={editingTariff?.name || ''}
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel>費率類型</InputLabel>
                  <Select
                    name="tariff_type"
                    value={tariffType}
                    onChange={handleTariffTypeChange}
                    label="費率類型"
                  >
                    {tariffTypeOptions.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                label="描述"
                name="description"
                fullWidth
                multiline
                rows={2}
                defaultValue={editingTariff?.description || ''}
                sx={{ mt: 2 }}
              />
            </Box>

            {/* 價格設定 */}
            <Box>
              <Typography variant="h6" color="primary" gutterBottom>
                價格設定
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="基本價格 (元/kWh)"
                  name="base_price"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.base_price || ''}
                  inputProps={{ step: 0.01, min: 0 }}
                  required
                />
                <TextField
                  label="服務費 (元)"
                  name="service_fee"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.service_fee || ''}
                  inputProps={{ step: 0.01, min: 0 }}
                />
                <TextField
                  label="最低收費 (元)"
                  name="minimum_fee"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.minimum_fee || ''}
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Stack>
            </Box>

            {/* 時間電價設定 */}
            {tariffType === 'TIME_OF_USE' && (
              <Box>
                <Typography variant="h6" color="primary" gutterBottom>
                  時間電價設定
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="尖峰時段開始"
                      name="peak_hours_start"
                      type="time"
                      fullWidth
                      defaultValue={editingTariff?.peak_hours_start || ''}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="尖峰時段結束"
                      name="peak_hours_end"
                      type="time"
                      fullWidth
                      defaultValue={editingTariff?.peak_hours_end || ''}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="尖峰電價 (元/kWh)"
                      name="peak_hours_price"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.peak_hours_price || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                    <TextField
                      label="離峰電價 (元/kWh)"
                      name="off_peak_price"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.off_peak_price || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                    <TextField
                      label="週末電價 (元/kWh)"
                      name="weekend_price"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.weekend_price || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* 累進費率設定 */}
            {tariffType === 'PROGRESSIVE' && (
              <Box>
                <Typography variant="h6" color="primary" gutterBottom>
                  累進費率設定
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="第一階段上限 (kWh)"
                      name="tier1_max_kwh"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.tier1_max_kwh || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                    <TextField
                      label="第一階段電價 (元/kWh)"
                      name="tier1_price"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.tier1_price || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="第二階段上限 (kWh)"
                      name="tier2_max_kwh"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.tier2_max_kwh || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                    <TextField
                      label="第二階段電價 (元/kWh)"
                      name="tier2_price"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.tier2_price || ''}
                      inputProps={{ step: 0.01, min: 0 }}
                    />
                  </Stack>
                  <TextField
                    label="第三階段電價 (元/kWh)"
                    name="tier3_price"
                    type="number"
                    fullWidth
                    defaultValue={editingTariff?.tier3_price || ''}
                    inputProps={{ step: 0.01, min: 0 }}
                    sx={{ maxWidth: { md: '50%' } }}
                  />
                </Stack>
              </Box>
            )}

            {/* 特殊優惠設定 */}
            {tariffType === 'SPECIAL_PROMOTION' && (
              <Box>
                <Typography variant="h6" color="primary" gutterBottom>
                  優惠設定
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="折扣百分比 (%)"
                      name="discount_percentage"
                      type="number"
                      fullWidth
                      defaultValue={editingTariff?.discount_percentage || ''}
                      inputProps={{ step: 0.01, min: 0, max: 100 }}
                    />
                    <TextField
                      label="優惠代碼"
                      name="promotion_code"
                      fullWidth
                      defaultValue={editingTariff?.promotion_code || ''}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="有效期限開始"
                      name="valid_from"
                      type="datetime-local"
                      fullWidth
                      defaultValue={editingTariff?.valid_from ? new Date(editingTariff.valid_from).toISOString().slice(0, 16) : ''}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="有效期限結束"
                      name="valid_to"
                      type="datetime-local"
                      fullWidth
                      defaultValue={editingTariff?.valid_to ? new Date(editingTariff.valid_to).toISOString().slice(0, 16) : ''}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* 設定選項 */}
            <Box>
              <Typography variant="h6" color="primary" gutterBottom>
                設定選項
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        name="is_active"
                        defaultChecked={editingTariff?.is_active ?? true}
                      />
                    }
                    label="啟用此費率方案"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        name="is_default"
                        defaultChecked={editingTariff?.is_default ?? false}
                      />
                    }
                    label="設為預設費率方案"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        name="membership_required"
                        defaultChecked={editingTariff?.membership_required ?? false}
                      />
                    }
                    label="需要會員資格"
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        name="ac_only"
                        defaultChecked={editingTariff?.ac_only ?? false}
                      />
                    }
                    label="僅適用 AC 充電"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        name="dc_only"
                        defaultChecked={editingTariff?.dc_only ?? false}
                      />
                    }
                    label="僅適用 DC 充電"
                  />
                </Box>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" variant="contained">
            {editingTariff ? '更新' : '新增'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
