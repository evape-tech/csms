// app/api/meters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getDatabaseClient } from '@/lib/database/adapter';

export const GET = async (request: NextRequest) => {
  try {
    await getDatabase();
    const client = getDatabaseClient() as any; // 避免跨資料庫 PrismaClient union 造成的 overload 衝突
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const stationId = searchParams.get('station_id') || searchParams.get('stationId');

    const where: any = {};
    if (search) {
      where.meter_no = { contains: search };
    }
    if (stationId) {
      where.station_id = parseInt(stationId);
    }

    const meters = await client.meters.findMany({
      where,
      select: {
        id: true,
        meter_no: true,
      },
      orderBy: { meter_no: 'asc' },
      take: 100, // 避免過多
    });

    return NextResponse.json({
      success: true,
      data: meters.map((m: { id: number; meter_no: string }) => m.meter_no),
    });
  } catch (error) {
    console.error('Failed to fetch meters:', error);
    return NextResponse.json(
      { success: false, message: '無法取得電表清單' },
      { status: 500 }
    );
  }
}; 