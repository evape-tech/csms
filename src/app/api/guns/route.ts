import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
// 使用統一的 database service 而不是直接使用 prisma
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseService } from '../../../lib/database/service.js';
import { getDatabase, getDatabaseClient } from '@/lib/database/adapter';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    const search = searchParams.get('search');
    const meterNoParam = searchParams.get('meterNo');

    console.log(`🔍 [API /api/guns] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);

    const stationIdParam = searchParams.get('station_id') || searchParams.get('stationId');

    // 🔍 如果有搜尋或電表過濾，使用進階查詢
    if (search || meterNoParam) {
      console.log(`🔍 [API /api/guns] 使用進階搜尋模式`);
      
      await getDatabase();
      const client = getDatabaseClient() as any;

      // 支援多個電表（用逗號分隔）
      const meterNos = meterNoParam
        ? meterNoParam.split(',').map(m => m.trim()).filter(Boolean)
        : [];

      // 準備查詢條件
      const where: any = {};

      // 場域過濾
      if (stationIdParam) {
        where.meter = { ...where.meter, station_id: parseInt(stationIdParam) };
      }

      // 🔍 模糊搜尋條件
      if (search) {
        where.OR = [
          { cpsn: { contains: search } },
          { cpid: { contains: search } },
          { connector: { contains: search } }
        ];
      }

      // 🔗 若有指定 meterNo，就透過關聯篩選
      if (meterNos.length > 0) {
        where.meter = {
          meter_no: { in: meterNos }
        };
      }

      const guns = await client.guns.findMany({
        where,
        select: {
          id: true,
          cpid: true,
          cpsn: true,
          connector: true,
          meter: { select: { meter_no: true } }
        },
        orderBy: [{ cpid: 'asc' }],
        take: 200
      });

      // 優先順序：
      const options = guns.map((g: any) => g.cpsn || g.connector || g.cpid || '').filter(Boolean);

      // 去重
      const unique = Array.from(new Set(options));

      console.log(`✅ [API /api/guns] 搜尋找到 ${unique.length} 筆結果`);
      return NextResponse.json({ success: true, data: unique });
    }

    // 🔵 否則使用基礎查詢（保持原有邏輯）
    console.log(`🔍 [API /api/guns] 使用基礎查詢模式`);
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    const stationId = searchParams.get('station_id') || searchParams.get('stationId');

    if (stationId) {
      filter.station_id = stationId;
      console.log(`🔍 [API /api/guns] Filtering by station_id: ${stationId}`);
    }

    if (cpid) {
      filter.cpid = cpid;
      console.log(`🔍 [API /api/guns] Filtering by cpid: ${cpid}`);
    }

    if (cpsn) {
      filter.cpsn = cpsn;
      console.log(`🔍 [API /api/guns] Filtering by cpsn: ${cpsn}`);
    }

    const rows = await databaseService.getGuns(filter);
    console.log(`✅ [API /api/guns] Found ${rows.length} guns records via databaseService`);

    // 如果有指定 cpid 或 cpsn，且只找到一筆，直接返回該物件而非陣列
    if ((cpid || cpsn) && rows.length === 1) {
      console.log(`✅ [API /api/guns] Returning single gun object`);
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error('API /api/guns error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    console.log(`🔍 [API /api/guns POST] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body.cpid !== undefined) data.cpid = body.cpid;
    if (body.cpsn !== undefined) data.cpsn = body.cpsn;
    if (body.acdc !== undefined) data.acdc = body.acdc;
    if (body.max_kw !== undefined) data.max_kw = body.max_kw;
    if (body.guns_memo1 !== undefined) data.guns_memo1 = body.guns_memo1;
    if (body.connector !== undefined) data.connector = body.connector;
    // Support optional incoming guns_status, otherwise default to 'Unavailable'
    if (body.guns_status !== undefined) data.guns_status = body.guns_status;
    else data.guns_status = 'Unavailable';
    // databaseService 會自動處理 createdAt 和 updatedAt
    
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }
    
    const created = await databaseService.createGun(data);
    console.log(`✅ [API /api/guns POST] Created gun via databaseService:`, created.id);
    
    // 清除快取
    revalidatePath('/api/guns');
    
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    console.error('API /api/guns POST error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
