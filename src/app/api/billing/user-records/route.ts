import { NextRequest, NextResponse } from 'next/server';
import { AuthHelper } from '../../../../lib/auth/authHelper';
import DatabaseUtils from '../../../../lib/database/utils.js';
import { databaseService } from '../../../../lib/database/service.js';

export const dynamic = 'force-dynamic';

/**
 * Get user's billing records
 * 
 * @route GET /api/billing/user-records
 * @auth Bearer Token or Cookie
 * 
 * @query start_date - Start date (YYYY-MM-DD)
 * @query end_date - End date (YYYY-MM-DD)
 * @query status - Billing status (default: CALCULATED)
 * @query cpid - Filter by charge point ID
 * @query cpsn - Filter by charge point serial number
 * @query limit - Number of results (default: 100)
 * @query offset - Offset for pagination (default: 0)
 * 
 * @returns { success: boolean, data: [...], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    // 驗證使用者
    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未登入或 token 無效' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status') || 'CALCULATED';
    const cpid = searchParams.get('cpid');
    const cpsn = searchParams.get('cpsn');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    console.log(`🔍 [API /api/billing/user-records] 查詢營收記錄`);

    // 構建查詢條件 (限制只能查詢自己的記錄)
    const where: any = { 
      status,
      user_id: currentUser.userId,
    };

    if (cpid) where.cpid = cpid;
    if (cpsn) where.cpsn = cpsn;

    if (startDate || endDate) {
      const gte = startDate ? new Date(`${startDate}T00:00:00`) : undefined;
      const lte = endDate ? new Date(`${endDate}T23:59:59`) : undefined;
      where.start_time = {};
      if (gte) where.start_time.gte = gte;
      if (lte) where.start_time.lte = lte;

      console.log('🕒 篩選時間範圍 =>', {
        startDate,
        endDate,
        gte: gte?.toISOString(),
        lte: lte?.toISOString(),
      });
    }

    console.log('🧩 where 條件:', where);

    // 透過 databaseService 查詢
    const records = await databaseService.getBillingRecords(where);
    console.log('✅ 查得筆數:', records.length);

    // 分頁處理
    const total = records.length;
    // const paginated = records.slice(offset, offset + limit);
    const paginated = records; // 依實際需求是否分頁

    // 格式化資料
    const formattedRecords = paginated.map((rec: any) => ({
      id: Number(rec.id),
      transaction_id: rec.transaction_id,
      tariff_id: rec.tariff_id,
      applied_price: Number(rec.applied_price),
      energy_consumed: Number(rec.energy_consumed),
      energy_fee: Number(rec.energy_fee),
      service_fee: Number(rec.service_fee),
      discount_amount: rec.discount_amount ? Number(rec.discount_amount) : 0,
      tax_amount: rec.tax_amount ? Number(rec.tax_amount) : 0,
      total_amount: Number(rec.total_amount),
      currency: rec.currency,
      start_time: rec.start_time,
      end_time: rec.end_time,
      charging_duration: rec.charging_duration,
      cpid: rec.cpid,
      cpsn: rec.cpsn,
      user_id: rec.user_id,
      id_tag: rec.id_tag,
      payment_method: rec.payment_method,
      payment_reference: rec.payment_reference,
      payment_time: rec.payment_time,
      invoice_number: rec.invoice_number,
      status: rec.status,
      created_at: rec.createdAt,
      updated_at: rec.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedRecords,
      total,
      limit,
      offset,
      returned: formattedRecords.length,
    });
  } catch (error) {
    console.error('[API /api/billing/user-records] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '取得帳單紀錄失敗',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Create billing record
 * 
 * @route POST /api/billing/user-records
 * @auth Bearer Token or Cookie
 * 
 * @body {
 *   transaction_id, tariff_id, applied_price, energy_consumed,
 *   energy_fee, service_fee, total_amount, start_time, end_time,
 *   cpid, cpsn, connector_id, user_id, id_tag, status?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const currentUser = AuthHelper.getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '未登入或 token 無效' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      transaction_id,
      tariff_id,
      applied_price,
      energy_consumed,
      energy_fee,
      service_fee,
      discount_amount,
      tax_amount,
      total_amount,
      start_time,
      end_time,
      charging_duration,
      cpid,
      cpsn,
      connector_id,
      user_id,
      id_tag,
      payment_method,
      status = 'COMPLETED',
    } = body;

    if (
      !transaction_id ||
      !tariff_id ||
      !total_amount ||
      !start_time ||
      !end_time ||
      !cpid ||
      !cpsn ||
      !connector_id ||
      !user_id ||
      !id_tag
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            '缺少必要欄位: transaction_id, tariff_id, total_amount, start_time, end_time, cpid, cpsn, connector_id, user_id, id_tag',
        },
        { status: 400 }
      );
    }

    console.log(`🧾 [API /api/billing/user-records] 建立新的帳單記錄: ${transaction_id}`);

    const record = await databaseService.createBillingRecord({
      transaction_id,
      tariff_id,
      applied_price: parseFloat(applied_price),
      energy_consumed: parseFloat(energy_consumed),
      energy_fee: parseFloat(energy_fee),
      service_fee: parseFloat(service_fee),
      discount_amount: discount_amount ? parseFloat(discount_amount) : 0,
      tax_amount: tax_amount ? parseFloat(tax_amount) : 0,
      total_amount: parseFloat(total_amount),
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      charging_duration: parseInt(charging_duration || 0, 10),
      cpid,
      cpsn,
      connector_id: parseInt(connector_id, 10),
      user_id,
      id_tag,
      payment_method,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const formattedRecord = {
      id: Number(record.id),
      transaction_id: record.transaction_id,
      tariff_id: record.tariff_id,
      applied_price: Number(record.applied_price),
      energy_consumed: Number(record.energy_consumed),
      energy_fee: Number(record.energy_fee),
      service_fee: Number(record.service_fee),
      discount_amount: record.discount_amount ? Number(record.discount_amount) : 0,
      tax_amount: record.tax_amount ? Number(record.tax_amount) : 0,
      total_amount: Number(record.total_amount),
      start_time: record.start_time,
      end_time: record.end_time,
      charging_duration: record.charging_duration,
      cpid: record.cpid,
      cpsn: record.cpsn,
      user_id: record.user_id,
      id_tag: record.id_tag,
      payment_method: record.payment_method,
      status: record.status,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };

    return NextResponse.json(
      { success: true, record: formattedRecord, message: '成功建立帳單記錄' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API /api/billing/user-records] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '建立帳單記錄失敗',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
