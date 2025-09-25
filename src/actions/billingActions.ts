/**
 * 計費相關的 Server Actions
 * 專門處理計費記錄的操作，遵循 Next.js App Router 最佳實踐
 */
'use server';

import { revalidatePath } from 'next/cache';
import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

interface BillingFilters {
  transactionId?: string;
  userId?: string;
  idTag?: string;
  cpid?: string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

interface StatisticsFilters {
  startDate?: string;
  endDate?: string;
  cpid?: string;
  status?: string;
}

interface Pagination {
  page: number;
  limit: number;
}

/**
 * 獲取計費記錄列表
 * @param {BillingFilters} filters - 過濾條件
 * @param {Pagination} pagination - 分頁參數
 * @returns {Promise<Object>} 計費記錄列表和分頁信息
 */
export async function getBillingRecords(filters: BillingFilters = {}, pagination: Pagination = { page: 1, limit: 20 }) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // 構建查詢條件
    const where: any = {};

    if (filters.transactionId) {
      where.transaction_id = { contains: filters.transactionId };
    }
    
    if (filters.userId) {
      where.user_id = { contains: filters.userId };
    }
    
    if (filters.idTag) {
      where.id_tag = { contains: filters.idTag };
    }
    
    if (filters.cpid) {
      where.cpid = { contains: filters.cpid };
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.startDateFrom && filters.startDateTo) {
      where.start_time = {
        gte: new Date(filters.startDateFrom),
        lte: new Date(filters.startDateTo)
      };
    } else if (filters.startDateFrom) {
      where.start_time = { gte: new Date(filters.startDateFrom) };
    } else if (filters.startDateTo) {
      where.start_time = { lte: new Date(filters.startDateTo) };
    }

    // 獲取總數
    const total = await client.billing_records.count({ where });

    // 獲取分頁數據
    const records = await client.billing_records.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tariff: {
          select: {
            id: true,
            name: true,
            tariff_type: true
          }
        }
      }
    });

    return {
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    console.error('Error fetching billing records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '獲取計費記錄失敗'
    };
  }
}

/**
 * 手動生成計費記錄
 * @param {string} transactionId - 交易ID
 * @param {Object} options - 選項
 * @returns {Promise<Object>} 生成結果
 */
export async function generateBillingRecord(transactionId: string, options: any = {}) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    
    // 這裡應該使用計費邏輯，但為了避免直接依賴 server 服務，
    // 我們需要重新實現或者通過其他方式調用
    
    // 暫時返回成功，實際實現需要根據具體需求調整
    return {
      success: true,
      message: '計費記錄生成功能需要進一步實現'
    };
  } catch (error) {
    console.error('Error generating billing record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成計費記錄失敗'
    };
  }
}

/**
 * 更新計費記錄狀態
 * @param {number} recordId - 記錄ID
 * @param {string} status - 新狀態
 * @param {Object} additionalData - 額外數據
 * @returns {Promise<Object>} 更新結果
 */
export async function updateBillingRecordStatus(recordId: number, status: string, additionalData: any = {}) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    // 驗證狀態是否有效
    const validStatuses = ['PENDING', 'CALCULATED', 'INVOICED', 'PAID', 'CANCELLED', 'ERROR'];
    if (!validStatuses.includes(status)) {
      throw new Error(`無效的計費狀態: ${status}`);
    }

    const updatedRecord = await client.billing_records.update({
      where: { id: recordId },
      data: {
        status,
        ...additionalData,
        updatedAt: new Date()
      }
    });

    revalidatePath('/billing/records');
    
    return {
      success: true,
      data: updatedRecord
    };
  } catch (error) {
    console.error('Error updating billing record status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新計費記錄狀態失敗'
    };
  }
}

/**
 * 獲取計費統計信息
 * @param {StatisticsFilters} filters - 過濾條件
 * @returns {Promise<Object>} 統計信息
 */
export async function getBillingStatistics(filters: StatisticsFilters = {}) {
  try {
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);
    const client = getDatabaseClient() as any;

    const where: any = {};

    // 構建過濾條件
    if (filters.startDate && filters.endDate) {
      where.start_time = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    }

    if (filters.cpid) {
      where.cpid = filters.cpid;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    // 獲取記錄
    const records = await client.billing_records.findMany({
      where,
      select: {
        id: true,
        total_amount: true,
        energy_consumed: true,
        energy_fee: true,
        discount_amount: true,
        status: true
      }
    });

    // 計算統計信息
    const totalRecords = records.length;
    const totalAmount = records.reduce((sum: number, record: any) => sum + parseFloat(record.total_amount || 0), 0);
    const totalEnergyConsumed = records.reduce((sum: number, record: any) => sum + parseFloat(record.energy_consumed || 0), 0);
    const totalEnergyFee = records.reduce((sum: number, record: any) => sum + parseFloat(record.energy_fee || 0), 0);
    const totalDiscountAmount = records.reduce((sum: number, record: any) => sum + parseFloat(record.discount_amount || 0), 0);

    // 按狀態分組統計
    const statusStats: any = {};
    records.forEach((record: any) => {
      const status = record.status || 'UNKNOWN';
      if (!statusStats[status]) {
        statusStats[status] = { count: 0, amount: 0 };
      }
      statusStats[status].count++;
      statusStats[status].amount += parseFloat(record.total_amount || 0);
    });

    return {
      success: true,
      data: {
        totalRecords,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        totalEnergyConsumed: parseFloat(totalEnergyConsumed.toFixed(2)),
        totalEnergyFee: parseFloat(totalEnergyFee.toFixed(2)),
        totalDiscountAmount: parseFloat(totalDiscountAmount.toFixed(2)),
        averageAmount: totalRecords > 0 ? parseFloat((totalAmount / totalRecords).toFixed(2)) : 0,
        averageEnergyConsumed: totalRecords > 0 ? parseFloat((totalEnergyConsumed / totalRecords).toFixed(2)) : 0,
        statusStats
      }
    };
  } catch (error) {
    console.error('Error fetching billing statistics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '獲取計費統計失敗'
    };
  }
}
