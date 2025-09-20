import { NextResponse } from 'next/server';
import { AuthUtils } from '../../../../../lib/auth/auth';
import { databaseService } from '../../../../../lib/database/service';

// 強制動態渲染，避免靜態快取
export const dynamic = 'force-dynamic';

// GET /api/guns/[id]/tariffs - 獲取指定槍的關聯費率
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 驗證用戶身份
    const user = await AuthUtils.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gunId = parseInt(params.id);
    if (isNaN(gunId)) {
      return NextResponse.json({ error: 'Invalid gun ID' }, { status: 400 });
    }

    // 獲取槍的關聯費率
    const gunTariffs = await databaseService.getGunTariffs(gunId);
    console.log(`✅ [API /api/guns/${gunId}/tariffs] Found ${gunTariffs.length} tariff associations`);

    return NextResponse.json(gunTariffs);
  } catch (err: unknown) {
    console.error('/api/guns/[id]/tariffs GET error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

// POST /api/guns/[id]/tariffs - 為指定槍添加費率關聯
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 驗證用戶身份和權限
    const user = await AuthUtils.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gunId = parseInt(params.id);
    if (isNaN(gunId)) {
      return NextResponse.json({ error: 'Invalid gun ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { tariff_id, priority = 1, is_active = true } = body;

    if (!tariff_id) {
      return NextResponse.json({ error: 'tariff_id is required' }, { status: 400 });
    }

    // 檢查槍是否存在
    const gun = await databaseService.getGunById(gunId);
    if (!gun) {
      return NextResponse.json({ error: 'Gun not found' }, { status: 404 });
    }

    // 檢查費率是否存在
    const tariff = await databaseService.getTariffById(tariff_id);
    if (!tariff) {
      return NextResponse.json({ error: 'Tariff not found' }, { status: 404 });
    }

    // 創建槍-費率關聯
    const gunTariff = await databaseService.createGunTariff({
      gun_id: gunId,
      tariff_id: parseInt(tariff_id),
      priority,
      is_active
    });

    console.log(`✅ [API /api/guns/${gunId}/tariffs] Created tariff association:`, gunTariff);

    return NextResponse.json(gunTariff, { status: 201 });
  } catch (err: unknown) {
    console.error('/api/guns/[id]/tariffs POST error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

// PUT /api/guns/[id]/tariffs/[tariffId] - 更新槍的費率關聯
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 驗證用戶身份和權限
    const user = await AuthUtils.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gunId = parseInt(params.id);
    if (isNaN(gunId)) {
      return NextResponse.json({ error: 'Invalid gun ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { tariff_id, priority, is_active } = body;

    if (!tariff_id) {
      return NextResponse.json({ error: 'tariff_id is required' }, { status: 400 });
    }

    // 更新槍-費率關聯
    const gunTariff = await databaseService.updateGunTariff(gunId, parseInt(tariff_id), {
      priority,
      is_active
    });

    if (!gunTariff) {
      return NextResponse.json({ error: 'Gun-tariff association not found' }, { status: 404 });
    }

    console.log(`✅ [API /api/guns/${gunId}/tariffs] Updated tariff association:`, gunTariff);

    return NextResponse.json(gunTariff);
  } catch (err: unknown) {
    console.error('/api/guns/[id]/tariffs PUT error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}

// DELETE /api/guns/[id]/tariffs/[tariffId] - 刪除槍的費率關聯
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 驗證用戶身份和權限
    const user = await AuthUtils.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gunId = parseInt(params.id);
    if (isNaN(gunId)) {
      return NextResponse.json({ error: 'Invalid gun ID' }, { status: 400 });
    }

    const url = new URL(req.url);
    const tariffId = url.searchParams.get('tariff_id');

    if (!tariffId) {
      return NextResponse.json({ error: 'tariff_id query parameter is required' }, { status: 400 });
    }

    // 刪除槍-費率關聯
    const deleted = await databaseService.deleteGunTariff(gunId, parseInt(tariffId));

    if (!deleted) {
      return NextResponse.json({ error: 'Gun-tariff association not found' }, { status: 404 });
    }

    console.log(`✅ [API /api/guns/${gunId}/tariffs] Deleted tariff association for tariff ${tariffId}`);

    return NextResponse.json({ message: 'Gun-tariff association deleted successfully' });
  } catch (err: unknown) {
    console.error('/api/guns/[id]/tariffs DELETE error', err instanceof Error ? err.stack : err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
