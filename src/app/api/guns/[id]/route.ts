import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
// 使用統一的 database service
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      
      // 使用 revalidatePath 清除相關快取
      revalidatePath('/api/guns');
      
      return NextResponse.json({ success: true, updated });
    } catch (err: unknown) {
      // if record not found, prisma throws
      console.error('[api/guns/[id]] update error', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'Update failed', message: errorMessage }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error('/api/guns/[id] POST error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      
      // 使用 revalidatePath 清除相關快取
      revalidatePath('/api/guns');
      
      return NextResponse.json({ success: true, deleted });
    } catch (err: unknown) {
      console.error('[api/guns/[id]] delete error', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'Delete failed', message: errorMessage }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error('/api/guns/[id] DELETE error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      
      // 使用 revalidatePath 清除相關快取
      revalidatePath('/api/guns');
      
      return NextResponse.json({ success: true, updated });
    } catch (err: unknown) {
      console.error('[api/guns/[id]] PATCH error', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'Update failed', message: errorMessage }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error('/api/guns/[id] PATCH error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const resolvedParams = params instanceof Promise ? await params : params;
    const gunId = resolvedParams?.id;
    if (!gunId) return NextResponse.json({ error: 'Missing gun id' }, { status: 400 });

    const numericId = Number(gunId);
    const id = isNaN(numericId) ? gunId : numericId;

    let gun: any = null;

    // 優先使用 databaseService 明確的讀取方法（若有）
    if (databaseService && typeof (databaseService as any).getGun === 'function') {
      gun = await (databaseService as any).getGun(id);
    } else if (databaseService && typeof (databaseService as any).findGun === 'function') {
      gun = await (databaseService as any).findGun(id);
    } else if (databaseService && typeof (databaseService as any).get === 'function') {
      gun = await (databaseService as any).get(id);
    } else if (databaseService && typeof (databaseService as any).listGuns === 'function') {
      const list = await (databaseService as any).listGuns();
      gun = Array.isArray(list) ? list.find((g: any) => String(g.id) === String(id)) ?? null : null;
    } else {
      // 無可用方法時回傳 501，提示需實作 server 端讀取
      return NextResponse.json({ error: 'Server does not expose a GET method for guns' }, { status: 501 });
    }

    if (!gun) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 確保回傳包含 guns_metervalue1（前端會讀取此欄位）
    const payload = {
      ...gun,
      guns_metervalue1: gun.guns_metervalue1 ?? gun.metervalue1 ?? null
    };

    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error('GET /api/guns/[id] error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message }, { status: 500 });
  }
}
