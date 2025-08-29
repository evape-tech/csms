import { NextResponse, NextRequest } from 'next/server';
// 使用統一的 database service
const DatabaseUtils = require('../../../../lib/database/utils');
const { databaseService } = require('../../../../lib/database/service');

export async function POST(req: NextRequest, { params }: { params: any }) {
  try {
    console.log(`🔍 [API /api/guns/[id] POST] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    const resolvedParams = await params;
    const gunId = resolvedParams?.id;
    if (!gunId) return NextResponse.json({ error: 'Missing charger id' }, { status: 400 });

    const numericId = Number(gunId);
    const id = isNaN(numericId) ? gunId : numericId;

    // Prevent accidental updates with empty body
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    // Perform update
    try {
      const updated = await databaseService.updateGun(id, body);
      console.log(`✅ [API /api/guns/[id] POST] Updated gun via databaseService:`, updated.id);
      return NextResponse.json({ success: true, updated });
    } catch (err: any) {
      // if record not found, prisma throws
      console.error('[api/guns/[id]] update error', err);
      return NextResponse.json({ error: 'Update failed', message: err?.message ?? String(err) }, { status: 500 });
    }
  } catch (err: any) {
    console.error('/api/guns/[id] POST error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: any }) {
  try {
    console.log(`🔍 [API /api/guns/[id] DELETE] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const resolvedParams = await params;
    const gunId = resolvedParams?.id;
    if (!gunId) return NextResponse.json({ error: 'Missing charger id' }, { status: 400 });

    const numericId = Number(gunId);
    const id = isNaN(numericId) ? gunId : numericId;

    try {
      const deleted = await databaseService.deleteGun(id);
      console.log(`✅ [API /api/guns/[id] DELETE] Deleted gun via databaseService:`, deleted.id);
      return NextResponse.json({ success: true, deleted });
    } catch (err: any) {
      console.error('[api/guns/[id]] delete error', err);
      return NextResponse.json({ error: 'Delete failed', message: err?.message ?? String(err) }, { status: 500 });
    }
  } catch (err: any) {
    console.error('/api/guns/[id] DELETE error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: any }) {
  try {
    console.log(`🔍 [API /api/guns/[id] PATCH] DB_PROVIDER = "${process.env.DB_PROVIDER}"`);
    
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    const body = await req.json().catch(() => ({}));
    const resolvedParams = await params;
    const gunId = resolvedParams?.id;
    if (!gunId) return NextResponse.json({ error: 'Missing charger id' }, { status: 400 });

    const numericId = Number(gunId);
    const id = isNaN(numericId) ? gunId : numericId;

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    try {
      const updated = await databaseService.updateGun(id, body);
      console.log(`✅ [API /api/guns/[id] PATCH] Updated gun via databaseService:`, updated.id);
      return NextResponse.json({ success: true, updated });
    } catch (err: any) {
      console.error('[api/guns/[id]] PATCH error', err);
      return NextResponse.json({ error: 'Update failed', message: err?.message ?? String(err) }, { status: 500 });
    }
  } catch (err: any) {
    console.error('/api/guns/[id] PATCH error', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: 'Internal Server Error', message: err?.message ?? String(err) }, { status: 500 });
  }
}
