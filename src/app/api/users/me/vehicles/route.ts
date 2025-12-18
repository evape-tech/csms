import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 查看當前用戶的愛車列表
 * 
 * @route GET /api/users/me/vehicles
 * @auth Cookie 或 Bearer Token
 * @query status - 可選，篩選狀態 (ACTIVE | INACTIVE | SOLD)
 * @returns { success: boolean, vehicles: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登入或 token 無效' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status')?.toUpperCase();

    // 驗證 status 參數
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SOLD'];
    const status = statusFilter && validStatuses.includes(statusFilter) ? statusFilter : null;

    const vehiclesResult = await databaseService.getUserVehicles(currentUser.userId, status as any);

    const vehicles = vehiclesResult.map((v: any) => ({
      id: Number(v.id),
      userId: v.user_id,
      brandId: Number(v.brand_id),
      brandName: v.vehicle_brands?.name,
      brandNameEn: v.vehicle_brands?.name_en,
      brandLogoUrl: v.vehicle_brands?.logo_url,
      modelName: v.model_name,
      licensePlate: v.license_plate,
      nickname: v.nickname,
      color: v.color,
      modelYear: v.model_year,
      vin: v.vin,
      purchaseDate: v.purchase_date,
      batteryCapacityKwh: v.battery_capacity_kwh ? Number(v.battery_capacity_kwh) : null,
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt
    }));

    return NextResponse.json({ 
      success: true, 
      vehicles,
      total: vehicles.length
    });

  } catch (error) {
    console.error('[API /api/users/me/vehicles GET] error:', error);
    return NextResponse.json({ error: '取得愛車列表失敗' }, { status: 500 });
  }
}

/**
 * 新增愛車
 * 
 * @route POST /api/users/me/vehicles
 * @auth Cookie 或 Bearer Token
 * @body { 
 *   brandId: number, 
 *   modelName: string, 
 *   licensePlate: string, 
 *   nickname?: string,
 *   color?: string,
 *   modelYear?: number,
 *   vin?: string,
 *   purchaseDate?: string,
 *   batteryCapacityKwh?: number
 * }
 * @returns { success: boolean, vehicle: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登入或 token 無效' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      brandId, 
      modelName, 
      licensePlate, 
      nickname, 
      color, 
      modelYear, 
      vin, 
      purchaseDate,
      batteryCapacityKwh
    } = body;

    // 驗證必填欄位
    if (!brandId || !modelName || !licensePlate) {
      return NextResponse.json({ 
        error: '缺少必填欄位：brandId, modelName, licensePlate' 
      }, { status: 400 });
    }

    // 檢查當前用戶的車輛數量（最多 5 輛）
    const currentVehicleCount = await databaseService.countUserVehicles(currentUser.userId);

    if (currentVehicleCount >= 5) {
      return NextResponse.json({ 
        error: '每位使用者最多只能新增 5 輛愛車',
        currentCount: currentVehicleCount,
        maxAllowed: 5
      }, { status: 400 });
    }

    // 檢查 brand_id 是否存在且啟用
    const brand = await databaseService.getVehicleBrandById(Number(brandId));

    if (!brand || !brand.is_active) {
      return NextResponse.json({ 
        error: '無效的品牌 ID 或品牌未啟用' 
      }, { status: 400 });
    }

    // 檢查車牌是否已存在
    const licensePlateExists = await databaseService.checkLicensePlateExists(licensePlate);

    if (licensePlateExists) {
      return NextResponse.json({ 
        error: '此車牌號碼已被註冊' 
      }, { status: 409 });
    }

    // 新增車輛
    const newVehicle = await databaseService.createUserVehicle({
      user_id: currentUser.userId,
      brand_id: Number(brandId),
      model_name: modelName,
      license_plate: licensePlate,
      nickname: nickname || null,
      color: color || null,
      model_year: modelYear ? Number(modelYear) : null,
      vin: vin || null,
      purchase_date: purchaseDate ? new Date(purchaseDate) : null,
      battery_capacity_kwh: batteryCapacityKwh ? Number(batteryCapacityKwh) : null,
      status: 'ACTIVE'
    });

    return NextResponse.json({ 
      success: true, 
      message: '愛車新增成功',
      vehicle: {
        id: Number(newVehicle.id),
        userId: newVehicle.user_id,
        brandId: Number(newVehicle.brand_id),
        brandName: newVehicle.vehicle_brands?.name,
        brandNameEn: newVehicle.vehicle_brands?.name_en,
        brandLogoUrl: newVehicle.vehicle_brands?.logo_url,
        modelName: newVehicle.model_name,
        licensePlate: newVehicle.license_plate,
        nickname: newVehicle.nickname,
        color: newVehicle.color,
        modelYear: newVehicle.model_year,
        vin: newVehicle.vin,
        purchaseDate: newVehicle.purchase_date,
        batteryCapacityKwh: newVehicle.battery_capacity_kwh ? Number(newVehicle.battery_capacity_kwh) : null,
        status: newVehicle.status,
        createdAt: newVehicle.createdAt,
        updatedAt: newVehicle.updatedAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('[API /api/users/me/vehicles POST] error:', error);
    return NextResponse.json({ error: '新增愛車失敗' }, { status: 500 });
  }
}
