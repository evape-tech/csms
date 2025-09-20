import { getDatabaseClient } from '@/lib/database/adapter';
import { AuthUtils } from '@/lib/auth/auth';

export interface OperationLogData {
  userId?: string;
  userEmail?: string;
  userName?: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT' | 'RESET';
  entityType: 'USER' | 'STATION' | 'METER' | 'GUN' | 'TARIFF' | 'TRANSACTION' | 'BILLING' | 'WALLET' | 'RFID_CARD' | 'PAYMENT_CHANNEL' | 'SYSTEM_CONFIG';
  entityId?: string;
  entityName?: string;
  description?: string;
  status?: 'SUCCESS' | 'FAILED';
}

export class OperationLogger {
  private static async getCurrentAdmin(request?: Request): Promise<{ userId?: string; userEmail?: string; userName?: string }> {
    try {
      const currentUser = await AuthUtils.getCurrentUser(request);
      
      if (!currentUser) {
        // 如果無法獲取用戶信息，拋出認證錯誤
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      // 檢查是否為管理員
      if (!AuthUtils.isAdmin(currentUser)) {
        console.warn('非管理員用戶嘗試執行需要記錄的操作:', currentUser.email);
        return {
          userId: currentUser.userId,
          userEmail: currentUser.email,
          userName: AuthUtils.getUserDisplayName(currentUser) + ' (非管理員)'
        };
      }

      return {
        userId: currentUser.userId,
        userEmail: currentUser.email,
        userName: AuthUtils.getUserDisplayName(currentUser)
      };
    } catch (error) {
      console.error('獲取當前管理員信息失敗:', error);
      return {
        userId: 'unknown',
        userEmail: 'unknown@csms.local',
        userName: '未知用戶'
      };
    }
  }

  static async log(data: Omit<OperationLogData, 'userId' | 'userEmail' | 'userName'>, request?: Request): Promise<void> {
    let db;
    let adminInfo;
    
    try {
      db = getDatabaseClient();
      adminInfo = await this.getCurrentAdmin(request);

      // 驗證 userId 是否存在於資料庫中
      let validUserId: string | null = null;
      if (adminInfo.userId && adminInfo.userId !== 'unknown' && adminInfo.userId.length >= 10) {
        try {
          const userExists = await db.$queryRaw`
            SELECT uuid FROM users WHERE uuid = ${adminInfo.userId} LIMIT 1
          `;
          if (Array.isArray(userExists) && userExists.length > 0) {
            validUserId = adminInfo.userId;
          } else {
            console.warn(`用戶 ID '${adminInfo.userId}' 在資料庫中不存在，將記錄為 null`);
          }
        } catch (userCheckError) {
          console.warn('檢查用戶 ID 時發生錯誤，將記錄為 null:', userCheckError);
        }
      }

      await db.$executeRaw`
        INSERT INTO operation_logs (
          user_id,
          user_email,
          user_name,
          action_type,
          entity_type,
          entity_id,
          entity_name,
          description,
          status,
          createdAt
        ) VALUES (
          ${validUserId},
          ${adminInfo.userEmail},
          ${adminInfo.userName},
          ${data.actionType},
          ${data.entityType},
          ${data.entityId || null},
          ${data.entityName || null},
          ${data.description || null},
          ${data.status || 'SUCCESS'},
          NOW()
        )
      `;
    } catch (error) {
      // 檢查是否為資料庫未初始化錯誤
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log(`⚠️ 資料庫未初始化，跳過操作日誌記錄: ${data.actionType} - ${data.entityType}`);
        return;
      }
      
      if (error instanceof Error && error.message === 'AUTHENTICATION_REQUIRED') {
        // 認證錯誤，重新拋出讓上層處理
        throw error;
      }
      console.error('操作日誌記錄失敗:', error);
      // 如果仍然是外鍵約束錯誤，嘗試不使用 user_id
      if (error instanceof Error && error.message.includes('foreign key constraint') && db && adminInfo) {
        try {
          console.log('嘗試不使用 user_id 重新記錄日誌...');
          await db.$executeRaw`
            INSERT INTO operation_logs (
              user_email,
              user_name,
              action_type,
              entity_type,
              entity_id,
              entity_name,
              description,
              status,
              createdAt
            ) VALUES (
              ${adminInfo.userEmail},
              ${adminInfo.userName},
              ${data.actionType},
              ${data.entityType},
              ${data.entityId || null},
              ${data.entityName || null},
              ${data.description || null},
              ${data.status || 'SUCCESS'},
              NOW()
            )
          `;
          console.log('日誌記錄成功 (不使用 user_id)');
        } catch (retryError) {
          console.error('重試日誌記錄也失敗:', retryError);
        }
      }
      // 其他錯誤不要因為日誌記錄失敗而影響主要操作
    }
  }

  // 便捷方法：用戶管理操作
  static async logUserOperation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    userId: string,
    userName: string,
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'USER',
      entityId: userId,
      entityName: userName,
      description: description || `${action === 'CREATE' ? '創建' : action === 'UPDATE' ? '更新' : '刪除'}用戶: ${userName}`
    }, request);
  }

  // 便捷方法：RFID 卡片操作
  static async logCardOperation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    cardId: string,
    cardNumber: string,
    userId?: string,
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'RFID_CARD',
      entityId: cardId,
      entityName: `卡片: ${cardNumber}`,
      description: description || `${action === 'CREATE' ? '新增' : action === 'UPDATE' ? '更新' : '刪除'}RFID卡片: ${cardNumber}${userId ? ` (用戶: ${userId})` : ''}`
    }, request);
  }

  // 便捷方法：錢包操作
  static async logWalletOperation(
    action: 'CREATE' | 'UPDATE',
    userId: string,
    amount: number,
    type: 'TOPUP' | 'DEDUCT',
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'WALLET',
      entityId: userId,
      entityName: `用戶錢包: ${userId}`,
      description: description || `錢包${type === 'TOPUP' ? '儲值' : '扣款'}: $${amount}`
    }, request);
  }

  // 便捷方法：充電站管理操作
  static async logStationOperation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    stationId: string,
    stationName: string,
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'STATION',
      entityId: stationId,
      entityName: stationName,
      description: description || `${action === 'CREATE' ? '創建' : action === 'UPDATE' ? '更新' : '刪除'}充電站: ${stationName}`
    }, request);
  }

  // 便捷方法：費率管理操作
  static async logTariffOperation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    tariffId: string,
    tariffName: string,
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'TARIFF',
      entityId: tariffId,
      entityName: tariffName,
      description: description || `${action === 'CREATE' ? '創建' : action === 'UPDATE' ? '更新' : '刪除'}費率: ${tariffName}`
    }, request);
  }

  // 便捷方法：登入登出操作
  static async logAuthOperation(
    action: 'LOGIN' | 'LOGOUT',
    userEmail: string,
    success: boolean = true,
    description?: string,
    request?: Request
  ) {
    // 對於認證操作，使用特殊處理避免認證檢查的循環依賴
    try {
      const db = getDatabaseClient();

      await db.$executeRaw`
        INSERT INTO operation_logs (
          user_email,
          user_name,
          action_type,
          entity_type,
          entity_name,
          description,
          status,
          createdAt
        ) VALUES (
          ${userEmail},
          ${userEmail},
          ${action},
          ${'USER'},
          ${userEmail},
          ${description || `管理員${action === 'LOGIN' ? '登入' : '登出'}: ${userEmail}`},
          ${success ? 'SUCCESS' : 'FAILED'},
          NOW()
        )
      `;
      console.log(`操作日誌記錄成功: ${action} - ${userEmail}`);
    } catch (error) {
      // 檢查是否為資料庫未初始化錯誤
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log(`⚠️ 資料庫未初始化，跳過認證日誌記錄: ${action} - ${userEmail}`);
        // 資料庫未初始化時，不記錄錯誤，只是靜默跳過
        return;
      }
      
      console.error('認證操作日誌記錄失敗:', error);
      // 其他錯誤也不影響主要操作，只記錄錯誤
    }
  }

  // 便捷方法：系統配置操作
  static async logSystemOperation(
    action: 'UPDATE' | 'EXPORT' | 'IMPORT',
    configName: string,
    description?: string,
    request?: Request
  ) {
    await this.log({
      actionType: action,
      entityType: 'SYSTEM_CONFIG',
      entityName: configName,
      description: description || `系統配置${action === 'UPDATE' ? '更新' : action === 'EXPORT' ? '匯出' : '匯入'}: ${configName}`
    }, request);
  }
}
