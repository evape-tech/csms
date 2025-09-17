'use server';

import { revalidatePath } from 'next/cache';
import DatabaseUtils from '../lib/database/utils.js';
import { getDatabaseClient } from '../lib/database/adapter.js';

// 創建新用戶
export async function createUser(formData: FormData) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const name = formData.get('name') as string;
    const account = formData.get('account') as string;
    const phone = formData.get('phone') as string;
    const status = formData.get('status') as string;

    if (!email || !password || !role) {
      throw new Error('Email、密碼和角色為必填項');
    }

    // 檢查 email 是否已存在
    const existingUser = await client.users.findFirst({
      where: { email }
    });

    if (existingUser) {
      throw new Error('Email 已存在');
    }

    // 對於基本用戶表，我們只存儲 email, password, role
    // 其他字段可能需要擴展用戶表結構
    const newUser = await client.users.create({
      data: {
        email,
        password, // 注意：實際應用中應該加密密碼
        role,
        // 如果有擴展字段，可以添加：
        // name,
        // account,
        // phone,
        // status: status === 'active' ? 1 : 0,
      }
    });

    revalidatePath('/user_management');
    return { success: true, data: newUser };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error instanceof Error ? error.message : '新增失敗' };
  }
}

// 更新用戶
export async function updateUser(userId: number, formData: FormData) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const name = formData.get('name') as string;
    const account = formData.get('account') as string;
    const phone = formData.get('phone') as string;
    const status = formData.get('status') as string;

    if (!email || !role) {
      throw new Error('Email 和角色為必填項');
    }

    const updatedUser = await client.users.update({
      where: { id: userId },
      data: {
        email,
        role,
        // 如果有擴展字段，可以更新：
        // name,
        // account,
        // phone,
        // status: status === 'active' ? 1 : 0,
      }
    });

    revalidatePath('/user_management');
    return { success: true, data: updatedUser };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error instanceof Error ? error.message : '更新失敗' };
  }
}

// 刪除用戶
export async function deleteUser(userId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    await client.users.delete({
      where: { id: userId }
    });

    revalidatePath('/user_management');
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: error instanceof Error ? error.message : '刪除失敗' };
  }
}

// 切換用戶狀態
export async function toggleUserStatus(userId: number) {
  try {
    // 確保資料庫已初始化
    await DatabaseUtils.initialize(process.env.DB_PROVIDER);

    const client = getDatabaseClient() as any;

    // 獲取當前用戶
    const user = await client.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('用戶不存在');
    }

    // 注意：當前用戶表沒有 status 字段
    // 如果需要狀態管理，需要擴展用戶表
    // 這裡先返回錯誤，提示需要擴展表結構
    throw new Error('用戶狀態管理需要擴展用戶表結構');

    // 如果有 status 字段，可以這樣實現：
    // const newStatus = user.status === 1 ? 0 : 1;
    // const updatedUser = await client.users.update({
    //   where: { id: userId },
    //   data: { status: newStatus }
    // });
    // revalidatePath('/user_management');
    // return { success: true, data: updatedUser };
  } catch (error) {
    console.error('Error toggling user status:', error);
    return { success: false, error: error instanceof Error ? error.message : '操作失敗' };
  }
}
