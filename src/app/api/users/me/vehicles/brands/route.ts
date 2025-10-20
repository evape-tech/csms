import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 取得車輛品牌列表（公開 API，不需認證）
 * 
 * @route GET /api/users/me/vehicles/brands
 * @returns { success: boolean, brands: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const brandsResult = await databaseService.getVehicleBrands(true);

    const brands = brandsResult.map((b: any) => ({
      id: Number(b.id),
      name: b.name,
      nameEn: b.name_en,
      logoUrl: b.logo_url,
      country: b.country,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt
    }));

    return NextResponse.json({ 
      success: true, 
      brands,
      total: brands.length
    });

  } catch (error) {
    console.error('[API /api/users/me/vehicles/brands GET] error:', error);
    return NextResponse.json({ error: '取得品牌列表失敗' }, { status: 500 });
  }
}
