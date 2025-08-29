import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ChargingStatusCard, CPCard } from '@/components/cards';
import { DisclaimerFooter } from '@/components/layout';
// 使用統一的 database service
const DatabaseUtils = require('../../lib/database/utils');
const { databaseService } = require('../../lib/database/service');

export default async function ChargingStatus() {
  // --- load Gun table directly via databaseService on the server ---
  let gunsFromDb: any[] = [];
  try {
    console.log(`🔍 [Page /charging_status] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const rows = await databaseService.getGuns({});
    // Serialize Date fields so they are safe to pass to client components
    gunsFromDb = rows.map((r: any) => ({
      ...r,
      createdAt: r.createdAt ? (r.createdAt as Date).toISOString() : null,
      updatedAt: r.updatedAt ? (r.updatedAt as Date).toISOString() : null,
    }));
    console.log(`✅ [Page /charging_status] Loaded guns via databaseService:`, gunsFromDb.length);
  } catch (err) {
    console.error('Failed to load guns from DB:', err);
    gunsFromDb = [];
  }

  return (
    <Box sx={{ p: 2, pb: 8 }}>

      {/* 充電樁狀態概覽卡片 */}
      <Box sx={{ mb: 2 }}>
        <ChargingStatusCard />
      </Box>

      {/* 充電樁列表與控制區塊（全部交由CPCard處理） */}
      <CPCard chargers={gunsFromDb} />

      {/* DisclaimerFooter 現在是固定定位，會自動顯示在底部 */}
      <DisclaimerFooter />
    </Box>
  );
}
