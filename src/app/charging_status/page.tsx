import Box from '@mui/material/Box';
import { ChargingStatusCard, CPCard } from '@/components/cards';
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

interface StationData {
  [key: string]: unknown;
}

interface MeterData {
  [key: string]: unknown;
}

export default async function ChargingStatus({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : {};
  const stationId = typeof params.stationId === 'string' ? params.stationId : undefined;

  // --- load Gun table directly via databaseService on the server ---
  let gunsFromDb: GunData[] = [];
  let stationsFromDb: StationData[] = [];
  let metersFromDb: MeterData[] = [];
  
  try {
    console.log(`🔍 [Page /charging_status] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 根據場域過濾
    const gunFilter: any = {};
    const stationFilter: any = {};
    const meterId = stationId ? parseInt(stationId) : null;
    if (stationId) {
      gunFilter.station_id = stationId;
      stationFilter.id = stationId;
    }
    
    // 並行獲取 guns、stations 和 meters 數據
    const [gunsRows, stationsRows, metersRows] = await Promise.all([
      databaseService.getGuns(gunFilter),
      databaseService.getStations(stationFilter),
      (databaseService as any).getMeters(stationId)
    ]);
    
    // 處理 guns 數據 - 使用 serializeData 函數處理 Decimal 和其他非序列化的數據
    gunsFromDb = gunsRows.map((r: Record<string, unknown>) => serializeData(r));
    
    // 處理 stations 數據 - 使用 serializeData 函數處理 Decimal 和其他非序列化的數據
    stationsFromDb = stationsRows.map((r: Record<string, unknown>) => serializeData(r));
    
    // 處理 meters 數據 - 使用 serializeData 函數處理 Decimal 和其他非序列化的數據
    metersFromDb = metersRows.map((r: Record<string, unknown>) => serializeData(r));
    
    // console.log(`✅ [Page /charging_status] Loaded guns via databaseService:`, gunsFromDb.length);
    // console.log(`✅ [Page /charging_status] Loaded stations via databaseService:`, stationsFromDb.length);
    // console.log(`✅ [Page /charging_status] Loaded meters via databaseService:`, metersFromDb.length);
    
    // 最後一次驗證確保所有數據都被序列化為純 JavaScript 對象
    gunsFromDb = JSON.parse(JSON.stringify(gunsFromDb));
    stationsFromDb = JSON.parse(JSON.stringify(stationsFromDb));
    metersFromDb = JSON.parse(JSON.stringify(metersFromDb));
  } catch (err) {
    console.error('Failed to load data from DB:', err);
    gunsFromDb = [];
    stationsFromDb = [];
    metersFromDb = [];
  }

  return (
    <Box sx={{ p: 2, pb: 8 }}>

      {/* 充電樁狀態概覽卡片 */}
      <Box sx={{ mb: 2 }}>
        <ChargingStatusCard stations={stationsFromDb} guns={gunsFromDb} />
      </Box>

      {/* 充電樁列表與控制區塊（全部交由CPCard處理） */}
      <CPCard chargers={gunsFromDb} stations={stationsFromDb} meters={metersFromDb} />
    </Box>
  );
}
