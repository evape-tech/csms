import React from 'react';
import { Box, Stack } from '@mui/material';
import {
  ChargingStatusCard,
  RealTimePowerCard,
  ErrorMonitorCard,
  CPListCard
} from '@/components/cards';
// 使用統一的 database service
import DatabaseUtils from '../../lib/database/utils.js';
import { databaseService } from '../../lib/database/service.js';

// 處理 Decimal 對象和其他非序列化的數據類型
function serializeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  // 處理 Decimal 對象 (檢查常見的 Decimal 對象特性)
  if (data.constructor && data.constructor.name === 'Decimal' || 
      typeof data.toFixed === 'function' && typeof data.toString === 'function') {
    return Number(data);
  }
  
  // 處理日期對象
  if (data instanceof Date) {
    return data.toISOString();
  }
  
  // 處理數組
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }
  
  // 處理對象
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeData(data[key]);
      }
    }
    return result;
  }
  
  // 基本類型原樣返回
  return data;
}

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';
// 每次請求都重新驗證資料
export const revalidate = 0;

// 類型定義，避免 TS 錯誤
interface GunData {
  [key: string]: unknown;
}

interface SiteSettingData {
  [key: string]: unknown;
}

export default async function Dashboard() {
  // --- load Gun table directly via databaseService on the server ---
  let gunsData: GunData[] = [];
  let siteSettings: SiteSettingData[] = [];
  
  try {
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 並行獲取 guns 和 site_settings 數據
    const [gunsRows, siteSettingsRows] = await Promise.all([
      databaseService.getGuns({}),
      databaseService.getSiteSettings()
    ]);
    
    // 處理 guns 數據 - 使用 serializeData 函數處理 Decimal 和其他非序列化的數據
    gunsData = gunsRows.map((r: Record<string, unknown>) => serializeData(r));
    
    // 處理 site_settings 數據 - 使用 serializeData 函數處理 Decimal 和其他非序列化的數據
    siteSettings = siteSettingsRows.map((r: Record<string, unknown>) => serializeData(r));

    
    // 打印 guns 數據的詳細信息以便調試
    if (gunsData.length > 0) {
      
      // 檢查關鍵字段的存在性
      const fieldCheck = {
        cpid: gunsData.filter(g => g.cpid).length,
        cpsn: gunsData.filter(g => g.cpsn).length,
        connector: gunsData.filter(g => g.connector).length,
        guns_status: gunsData.filter(g => g.guns_status).length,
        guns_metervalue1: gunsData.filter(g => g.guns_metervalue1).length
      };
      
      console.log('[Page /dashboard] Gun data field presence:', fieldCheck);
    } else {
      console.warn('[Page /dashboard] No gun data available');
    }
    
    // 最後一次驗證確保所有數據都被序列化為純 JavaScript 對象
    gunsData = JSON.parse(JSON.stringify(gunsData));
    siteSettings = JSON.parse(JSON.stringify(siteSettings));
  } catch (err) {
    console.error('Failed to load data from DB:', err);
    gunsData = [];
    siteSettings = [];
  }

  return (
    <Box sx={{ p: 2, pb: 8 }}> {/* 添加底部邊距為固定定位的 DisclaimerFooter 留出空間 */}
      {/* 充電樁狀態區塊 */}
      <Box sx={{ mb: 2 }}>
        <ChargingStatusCard siteSettings={siteSettings} guns={gunsData} />
      </Box>
      
      {/* 即時功率監控 + 即時異常監控區塊 */}
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
          {/* 左側即時功率監控 */}
          <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex' }}>
            <RealTimePowerCard />
          </Box>
          {/* 右側即時異常監控 */}
          <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex' }}>
            <ErrorMonitorCard />
          </Box>
        </Stack>
      </Box>
      
      {/* CP列表區塊 */}
      <Box sx={{ mb: 2 }}>
        <CPListCard chargers={gunsData} siteSettings={siteSettings} />
      </Box>
    </Box>
  );
}
