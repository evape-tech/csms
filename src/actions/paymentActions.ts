'use server';

import { revalidatePath } from 'next/cache';
import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

// 切換支付方式狀態
export async function togglePaymentMethodStatus(channelId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 獲取當前狀態
    const channel = await client.billing_channels.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new Error('支付方式不存在');
    }

    // 切換狀態
    const newStatus = channel.status === 1 ? 0 : 1;

    const updatedChannel = await client.billing_channels.update({
      where: { id: channelId },
      data: { status: newStatus }
    });

    revalidatePath('/users-permissions/payment_management');
    return { success: true, data: updatedChannel };
  } catch (error) {
    console.error('Error toggling payment method status:', error);
    return { success: false, error: error instanceof Error ? error.message : '操作失敗' };
  }
}

// 新增支付方式
export async function createPaymentMethod(data: { name: string; code: string; status: number; config?: any }) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const { name, code, status = 1, config = {} } = data;

    if (!name || !code) {
      throw new Error('名稱和代碼為必填項');
    }

    // 檢查代碼是否已存在
    const existingChannel = await client.billing_channels.findUnique({
      where: { code }
    });

    if (existingChannel) {
      throw new Error('代碼已存在');
    }

    const newChannel = await client.billing_channels.create({
      data: {
        name,
        code,
        status,
        config
      }
    });

    revalidatePath('/users-permissions/payment_management');
    return { success: true, data: newChannel };
  } catch (error) {
    console.error('Error creating payment method:', error);
    return { success: false, error: error instanceof Error ? error.message : '新增失敗' };
  }
}

// 更新支付方式
export async function updatePaymentMethod(channelId: number, data: { name: string; status: number; config?: any }) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const { name, status = 1, config } = data;

    if (!name) {
      throw new Error('名稱為必填項');
    }

    const updateData: any = {
      name,
      status
    };

    if (config !== undefined) {
      updateData.config = config;
    }

    const updatedChannel = await client.billing_channels.update({
      where: { id: channelId },
      data: updateData
    });

    revalidatePath('/users-permissions/payment_management');
    return { success: true, data: updatedChannel };
  } catch (error) {
    console.error('Error updating payment method:', error);
    return { success: false, error: error instanceof Error ? error.message : '更新失敗' };
  }
}

// 刪除支付方式
export async function deletePaymentMethod(channelId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 檢查是否有關聯的記錄
    const channel = await client.billing_channels.findUnique({
      where: { id: channelId },
      select: { code: true }
    });

    if (!channel) {
      throw new Error('支付方式不存在');
    }

    const relatedRecords = await client.billing_records.count({
      where: { payment_method: channel.code }
    });

    if (relatedRecords > 0) {
      throw new Error('該支付方式有關聯的支付記錄，無法刪除');
    }

    await client.billing_channels.delete({
      where: { id: channelId }
    });

    revalidatePath('/users-permissions/payment_management');
    return { success: true };
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return { success: false, error: error instanceof Error ? error.message : '刪除失敗' };
  }
}
