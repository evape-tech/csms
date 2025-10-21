import { NextRequest, NextResponse } from 'next/server';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * 查詢充電槍的所有費率方案
 * @route POST /api/guns/tariff
 * @body { cpid: string }
 * @returns 該充電槍的所有可用費率（由前端根據季節/時段選擇適用費率）
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 從 body 取得 cpid
    const body = await request.json();
    const { cpid } = body;

    if (!cpid) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少 cpid 參數' 
        },
        { status: 400 }
      );
    }

    console.log('🔍 [API /api/guns/tariff] 查詢費率方案:', { cpid });

    // 使用 cpid 查詢所有可用費率
    const tariffs: any[] = await databaseService.getGunTariffsByCpid(cpid);
    
    if (!tariffs || tariffs.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '找不到該充電槍或費率設定'
        },
        { status: 404 }
      );
    }

    console.log(`✅ [API /api/guns/tariff] 找到 ${tariffs.length} 個費率方案`);

    // 轉換所有費率為前端需要的格式
    const tariffsData = tariffs.map(tariff => ({
      id: tariff.id,
      name: tariff.name,
      description: tariff.description,
      tariff_type: tariff.tariff_type,
      base_price: tariff.base_price ? Number(tariff.base_price) : null,
      charging_parking_fee: tariff.charging_parking_fee ? Number(tariff.charging_parking_fee) : null,
      peak_hours_start: tariff.peak_hours_start,
      peak_hours_end: tariff.peak_hours_end,
      peak_hours_price: tariff.peak_hours_price ? Number(tariff.peak_hours_price) : null,
      off_peak_price: tariff.off_peak_price ? Number(tariff.off_peak_price) : null,
      weekend_price: tariff.weekend_price ? Number(tariff.weekend_price) : null,
      tier1_max_kwh: tariff.tier1_max_kwh ? Number(tariff.tier1_max_kwh) : null,
      tier1_price: tariff.tier1_price ? Number(tariff.tier1_price) : null,
      tier2_max_kwh: tariff.tier2_max_kwh ? Number(tariff.tier2_max_kwh) : null,
      tier2_price: tariff.tier2_price ? Number(tariff.tier2_price) : null,
      tier3_price: tariff.tier3_price ? Number(tariff.tier3_price) : null,
      discount_percentage: tariff.discount_percentage ? Number(tariff.discount_percentage) : null,
      grace_period_minutes: tariff.grace_period_minutes,
      penalty_rate_per_hour: tariff.penalty_rate_per_hour ? Number(tariff.penalty_rate_per_hour) : null,
      ac_only: tariff.ac_only,
      dc_only: tariff.dc_only,
      membership_required: tariff.membership_required,
      is_active: tariff.is_active,
      valid_from: tariff.valid_from,
      valid_to: tariff.valid_to,
      season_type: tariff.season_type,
      season_start_month: tariff.season_start_month,
      season_end_month: tariff.season_end_month
    }));

    return NextResponse.json({
      success: true,
      tariffs: tariffsData,
      count: tariffsData.length
    });

  } catch (error) {
    console.error('[API /api/guns/tariff] 錯誤:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '查詢費率失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
