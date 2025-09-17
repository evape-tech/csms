import { PrismaClient } from '../../../../../prisma-clients/mysql';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const keyword = searchParams.get('keyword');

    const skip = (page - 1) * limit;

    // 構建查詢條件
    const where = {};
    if (status) {
      where.status = status;
    }
    if (paymentMethod) {
      where.payment_method = paymentMethod;
    }
    if (keyword) {
      where.OR = [
        { user_id: { contains: keyword } },
        { transaction_id: { contains: keyword } },
        { id_tag: { contains: keyword } }
      ];
    }

    // 獲取總數
    const total = await prisma.billing_records.count({ where });

    // 獲取記錄
    const records = await prisma.billing_records.findMany({
      where,
      include: {
        billing_channels: true,
        tariff: true,
        transactions: {
          select: {
            cpid: true,
            cpsn: true,
            connector_id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // 格式化數據
    const formattedRecords = records.map(record => ({
      id: record.id,
      transactionId: record.transaction_id,
      userId: record.user_id,
      idTag: record.id_tag,
      amount: Number(record.total_amount),
      energyConsumed: Number(record.energy_consumed),
      paymentMethod: record.billing_channels?.name || record.payment_method || '未知',
      status: record.status,
      startTime: record.start_time.toISOString(),
      endTime: record.end_time.toISOString(),
      chargingDuration: record.charging_duration,
      cpid: record.cpid,
      cpsn: record.cpsn,
      connectorId: record.connector_id,
      invoiceNumber: record.invoice_number,
      createdAt: record.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: formattedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching billing records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing records'
      },
      { status: 500 }
    );
  }
}
