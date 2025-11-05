// /api/guns/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getDatabaseClient } from '@/lib/database/adapter';

export const GET = async (request: NextRequest) => {
  try {
    await getDatabase(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const meterNoParam = searchParams.get('meterNo') || '';

    // 支援多個電表（用逗號分隔）
    const meterNos = meterNoParam
      ? meterNoParam.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    // 準備查詢條件
    const where: any = {};

    // 🔍 模糊搜尋條件
    if (search) {
      where.OR = [        
        { cpsn: { contains: search } },
        { cpid: { contains: search } },
        { connector: { contains: search } }
      ];
    }

    // 🔗 若有指定 meterNo，就透過關聯篩選
    if (meterNos.length > 0) {
      where.meter = {
        meter_no: { in: meterNos }
      };
    }

    const guns = await client.guns.findMany({
      where,
      select: {
        id: true,
        cpid: true,
        cpsn: true,
        connector: true,
        meter: { select: { meter_no: true } }
      },
      orderBy: [{ cpid: 'asc' }],
      take: 200
    });

    // 優先順序：
    const options = guns.map((g: any) => g.cpsn || g.connector || g.cpid ||  '').filter(Boolean);

    // 去重
    const unique = Array.from(new Set(options));

    return NextResponse.json({ success: true, data: unique });
  } catch (error) {
    console.error('❌ Failed to fetch guns:', error);
    return NextResponse.json(
      { success: false, message: '無法取得充電樁清單' },
      { status: 500 }
    );
  }
};
