import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../../../lib/database/utils.js';
import { databaseService } from '../../../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 刪除愛車
 * 
 * @route DELETE /api/users/me/vehicles/[id]
 * @auth Cookie 或 Bearer Token
 * @param id - 車輛 ID
 * @returns { success: boolean, message: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: '未登入或 token 無效' }, { status: 401 });
    }

    const vehicleId = parseInt(params.id, 10);
    if (isNaN(vehicleId)) {
      return NextResponse.json({ error: '無效的車輛 ID' }, { status: 400 });
    }

    // 檢查車輛是否存在且屬於當前用戶
    const vehicle = await databaseService.getUserVehicleById(vehicleId);

    if (!vehicle) {
      return NextResponse.json({ error: '車輛不存在' }, { status: 404 });
    }

    // 確認車輛屬於當前用戶
    if (vehicle.user_id !== currentUser.userId) {
      return NextResponse.json({ 
        error: '無權限刪除此車輛' 
      }, { status: 403 });
    }

    // 刪除車輛
    await databaseService.deleteUserVehicle(vehicleId);

    return NextResponse.json({ 
      success: true, 
      message: '愛車已刪除',
      deletedVehicle: {
        id: Number(vehicle.id),
        licensePlate: vehicle.license_plate,
        modelName: vehicle.model_name
      }
    });

  } catch (error) {
    console.error('[API /api/users/me/vehicles/[id] DELETE] error:', error);
    return NextResponse.json({ error: '刪除愛車失敗' }, { status: 500 });
  }
}
