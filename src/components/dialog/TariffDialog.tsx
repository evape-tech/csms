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
  charging_parking_fee?: number;
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
  season_start_month?: number;
  season_end_month?: number;
  season_type: string;
  grace_period_minutes?: number;
  penalty_rate_per_hour?: number;
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
  onSuccess: () => void;
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

const seasonTypeOptions = [
  { value: 'ALL_YEAR', label: '全年適用' },
  { value: 'SUMMER', label: '夏季 (6-9月)' },
  { value: 'NON_SUMMER', label: '非夏季 (10-5月)' },
  { value: 'CUSTOM', label: '自訂月份' },
];

const monthOptions = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
];

export default function TariffDialog({
  open,
  onClose,
  onSuccess,
  editingTariff
}: TariffDialogProps) {
  const [tariffType, setTariffType] = React.useState(editingTariff?.tariff_type || 'FIXED_RATE');
  const [seasonType, setSeasonType] = React.useState(editingTariff?.season_type || 'ALL_YEAR');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    try {
      if (editingTariff) {
        // 調用更新 API
        const response = await fetch(`/api/tariffs/${editingTariff.id}`, {
          method: 'PUT',
          body: formData,
        });
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || result.error);
        }
      } else {
        // 調用創建 API
        const response = await fetch('/api/tariffs', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || result.error);
        }
      }
      
      onSuccess();
    } catch (error) {
      console.error('提交失敗:', error);
      alert(error instanceof Error ? error.message : '操作失敗');
    }
  };

  const handleTariffTypeChange = (event: any) => {
    setTariffType(event.target.value);
  };

  const handleSeasonTypeChange = (event: any) => {
    setSeasonType(event.target.value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {editingTariff ? '編輯費率方案' : '新增費率方案'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 隱藏欄位處理季節類型的自動設定 */}
            <input 
              type="hidden" 
              name="season_type" 
              value={seasonType === 'SUMMER' ? 'SUMMER' : seasonType === 'NON_SUMMER' ? 'NON_SUMMER' : seasonType}
            />
            {seasonType === 'SUMMER' && (
              <>
                <input type="hidden" name="season_start_month" value="6" />
                <input type="hidden" name="season_end_month" value="9" />
              </>
            )}
            {seasonType === 'NON_SUMMER' && (
              <>
                <input type="hidden" name="season_start_month" value="10" />
                <input type="hidden" name="season_end_month" value="5" />
              </>
            )}

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
                  label="充電期間停車費 (元)"
                  name="charging_parking_fee"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.charging_parking_fee || ''}
                  inputProps={{ step: 0.01, min: 0 }}
                />
                <TextField
                  label="寬限時間 (分鐘)"
                  name="grace_period_minutes"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.grace_period_minutes || 15}
                  inputProps={{ step: 1, min: 0 }}
                />
                <TextField
                  label="超時罰款 (元/小時)"
                  name="penalty_rate_per_hour"
                  type="number"
                  fullWidth
                  defaultValue={editingTariff?.penalty_rate_per_hour || ''}
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
            {(tariffType === 'SPECIAL_PROMOTION' || tariffType === 'MEMBERSHIP') && (
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
                </Stack>
              </Box>
            )}

            {/* 設定選項 */}
            <Box>
              <Typography variant="h6" color="primary" gutterBottom>
                適用範圍與時間
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>適用季節</InputLabel>
                  <Select
                    name="season_type"
                    value={seasonType}
                    onChange={handleSeasonTypeChange}
                    label="適用季節"
                  >
                    {seasonTypeOptions.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {seasonType === 'CUSTOM' && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>開始月份</InputLabel>
                      <Select
                        name="season_start_month"
                        defaultValue={editingTariff?.season_start_month || ''}
                        label="開始月份"
                      >
                        {monthOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel>結束月份</InputLabel>
                      <Select
                        name="season_end_month"
                        defaultValue={editingTariff?.season_end_month || ''}
                        label="結束月份"
                      >
                        {monthOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                )}

                {(tariffType === 'SPECIAL_PROMOTION' || editingTariff?.valid_from || editingTariff?.valid_to) && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="有效期限開始"
                      name="valid_from"
                      type="date"
                      fullWidth
                      defaultValue={editingTariff?.valid_from ? new Date(editingTariff.valid_from).toISOString().slice(0, 10) : ''}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="有效期限結束"
                      name="valid_to"
                      type="date"
                      fullWidth
                      defaultValue={editingTariff?.valid_to ? new Date(editingTariff.valid_to).toISOString().slice(0, 10) : ''}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                )}
              </Stack>
            </Box>

            {/* 系統設定 */}
            <Box>
              <Typography variant="h6" color="primary" gutterBottom>
                系統設定
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
