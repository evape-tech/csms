import { NextResponse } from 'next/server';
// 使用統一的 database service 而不是直接使用 prisma
const DatabaseUtils = require('../../../lib/database/utils');
const { databaseService } = require('../../../lib/database/service');

export async function GET() {
  try {
    console.log(`🔍 [API /api/guns] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const rows = await databaseService.getGuns({});
    console.log(`✅ [API /api/guns] Found ${rows.length} guns records via databaseService`);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('API /api/guns error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    console.log(`🔍 [API /api/guns POST] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    const data: any = {};
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
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('API /api/guns POST error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message ?? String(err) }, { status: 500 });
  }
}
