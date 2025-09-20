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
    const firstName = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    const phone = formData.get('phone') as string;
    const status = formData.get('account_status') as string;
    const emailVerified = formData.get('email_verified') as string;

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

    // 生成 UUID
    const uuid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 對於基本用戶表，我們把所有相關欄位都帶入
    const newUser = await client.users.create({
      data: {
        uuid,
        email,
        password, // 注意：實際應用中應該加密密碼
        role,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        email_verified: emailVerified === 'true',
        account_status: (status === 'active' || status === 'ACTIVE') ? 'ACTIVE' : 'PENDING',
        login_count: 0,
        failed_login_attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
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
    const name = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    const phone = formData.get('phone') as string;
    const status = formData.get('account_status') as string;
    const emailVerified = formData.get('email_verified') as string;

    if (!email || !role) {
      throw new Error('Email 和角色為必填項');
    }

    const updatedUser = await client.users.update({
      where: { id: userId },
      data: {
        email,
        role,
        first_name: name || null,
        last_name: lastName || null,
        phone: phone || null,
        email_verified: emailVerified === 'true',
        account_status: (status === 'active' || status === 'ACTIVE') ? 'ACTIVE' : 
                       (status === 'suspended' || status === 'SUSPENDED') ? 'SUSPENDED' :
                       (status === 'blocked' || status === 'BLOCKED') ? 'BLOCKED' : 'PENDING',
        updatedAt: new Date(),
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

    // 切換用戶狀態：ACTIVE <-> SUSPENDED
    const newStatus = user.account_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    const updatedUser = await client.users.update({
      where: { id: userId },
      data: { 
        account_status: newStatus,
        updatedAt: new Date()
      }
    });
    
    revalidatePath('/user_management');
    return { success: true, data: updatedUser };
  } catch (error) {
    console.error('Error toggling user status:', error);
    return { success: false, error: error instanceof Error ? error.message : '操作失敗' };
  }
}
