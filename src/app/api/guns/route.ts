import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
// 使用統一的 database service 而不是直接使用 prisma
import DatabaseUtils from '../../../lib/database/utils.js';
import { databaseService } from '../../../lib/database/service.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    console.log(`🔍 [API /api/guns] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 解析查詢參數
    const { searchParams } = new URL(req.url);
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    
    // 根據查詢參數建立過濾條件
    const filter: Record<string, any> = {};
    
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
