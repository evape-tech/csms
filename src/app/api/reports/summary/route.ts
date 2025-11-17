import { NextResponse } from 'next/server';
import DatabaseUtils from '@/lib/database/utils.js';
import { getDatabaseClient } from '@/lib/database/adapter.js';

export const dynamic = 'force-dynamic';

const getStartOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export async function GET() {
  try {
    const initialized = await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    if (!initialized) {
      return NextResponse.json(
        {
          success: false,
          message: '資料庫初始化失敗'
        },
        { status: 500 }
      );
    }

    const client = getDatabaseClient() as any;
    const startOfToday = getStartOfToday();

    const [
      chargingTotal,
      chargingToday,
      transactionsTotal,
      transactionsToday,
      systemTotal,
      systemToday,
      usageTotal,
      usageToday
    ] = await Promise.all([
      client.billing_records.count(),
      client.billing_records.count({
        where: {
          start_time: {
            gte: startOfToday
          }
        }
      }),
      client.wallet_transactions.count(),
      client.wallet_transactions.count({
        where: {
          createdAt: {
            gte: startOfToday
          }
        }
      }),
      client.operation_logs.count(),
      client.operation_logs.count({
        where: {
          createdAt: {
            gte: startOfToday
          }
        }
      }),
      client.charging_transactions.count(),
      client.charging_transactions.count({
        where: {
          start_time: {
            gte: startOfToday
          }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        charging: {
          count: chargingTotal,
          today: chargingToday
        },
        transactions: {
          count: transactionsTotal,
          today: transactionsToday
        },
        system: {
          count: systemTotal,
          today: systemToday
        },
        usage: {
          count: usageTotal,
          today: usageToday
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[GET /api/reports/summary] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: '取得報表摘要失敗',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
