'use server';

import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

/**
 * 獲取即時監控數據
 * @returns {Promise<Object>} 即時監控統計數據
 */
export async function getRealTimeMonitoringData() {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 獲取即時功率 - 正在充電中的交易的當前功率總和
    const currentPowerResult = await client.charging_transactions.aggregate({
      where: {
        status: 'ACTIVE',
        last_meter_update: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // 最近5分鐘內有更新
        },
      },
      _sum: {
        current_power: true,
      },
    });

    const currentPower = currentPowerResult._sum.current_power || 0;

    // 獲取今日用電量 - 今日完成的交易總用電量
    const todayConsumptionResult = await client.billing_records.aggregate({
      where: {
        start_time: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['CALCULATED', 'INVOICED', 'PAID'],
        },
      },
      _sum: {
        energy_consumed: true,
      },
    });

    const todayConsumption = todayConsumptionResult._sum.energy_consumed || 0;

    // 獲取今日營收 - 今日已付款或已開立發票的帳單總金額
    const todayRevenueResult = await client.billing_records.aggregate({
      where: {
        start_time: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['INVOICED', 'PAID'],
        },
      },
      _sum: {
        total_amount: true,
      },
    });

    const todayRevenue = todayRevenueResult._sum.total_amount || 0;

    // 獲取今日峰值功率 - 今日記錄的最大功率
    const peakPowerResult = await client.charging_transactions.aggregate({
      where: {
        last_meter_update: {
          gte: today,
          lt: tomorrow,
        },
        current_power: {
          not: null,
        },
      },
      _max: {
        current_power: true,
      },
    });

    const peakPower = peakPowerResult._max.current_power || 0;

    return {
      success: true,
      data: {
        currentPower: {
          label: '即時功率',
          value: Number(currentPower),
          unit: 'kW',
        },
        todayConsumption: {
          label: '今日用電量',
          value: Number(todayConsumption),
          unit: 'kWh',
        },
        todayRevenue: {
          label: '今日營收',
          value: Number(todayRevenue),
          unit: '元',
        },
        peakPower: {
          label: '今日峰值功率',
          value: Number(peakPower),
          unit: 'kW',
        },
      },
    };
  } catch (error) {
    console.error('獲取即時監控數據失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      data: {
        currentPower: {
          label: '即時功率',
          value: 0,
          unit: 'kW',
        },
        todayConsumption: {
          label: '今日用電量',
          value: 0,
          unit: 'kWh',
        },
        todayRevenue: {
          label: '今日營收',
          value: 0,
          unit: '元',
        },
        peakPower: {
          label: '今日峰值功率',
          value: 0,
          unit: 'kW',
        },
      },
    };
  }
}

/**
 * 獲取充電狀態統計
 * @returns {Promise<Object>} 充電狀態統計數據
 */
export async function getChargingStatusStats() {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    // 獲取各種狀態的充電槍數量
    const gunStats = await client.guns.groupBy({
      by: ['guns_status'],
      _count: {
        id: true,
      },
    });

    // 獲取正在充電的交易數量
    const activeTransactions = await client.charging_transactions.count({
      where: {
        status: 'ACTIVE',
      },
    });

    // 獲取今日完成的交易數量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCompletedTransactions = await client.charging_transactions.count({
      where: {
        status: 'COMPLETED',
        end_time: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      success: true,
      data: {
        gunStats,
        activeTransactions,
        todayCompletedTransactions,
      },
    };
  } catch (error) {
    console.error('獲取充電狀態統計失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      data: {
        gunStats: [],
        activeTransactions: 0,
        todayCompletedTransactions: 0,
      },
    };
  }
}
