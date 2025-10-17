import { databaseManager } from './adapter.js';
import { databaseService } from './service.js';

class DatabaseUtils {
  
  /**
   * 初始化數據庫連接
   */
  static async initialize(provider) {
    console.log(`🚀 [DatabaseUtils] initialize() called with provider: ${provider}`);
    try {
      await databaseManager.initialize(provider);
      const currentProvider = databaseManager.getProvider();
      // console.log(`🎉 [DatabaseUtils] Database connection established successfully with ${currentProvider?.toUpperCase()}`);
      
      return true;
    } catch (error) {
      console.error('💥 Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * 切換數據庫
   */
  static async switchDatabase(provider) {
    try {
      await databaseManager.switchDatabase(provider);
      console.log(`🔄 Successfully switched to ${provider.toUpperCase()}`);
      return true;
    } catch (error) {
      console.error(`💥 Failed to switch to ${provider}:`, error);
      return false;
    }
  }

  /**
   * 獲取當前數據庫提供商
   */
  static getCurrentProvider() {
    return databaseManager.getProvider();
  }

  /**
   * 數據庫健康檢查
   */
  static async healthCheck() {
    return await databaseManager.healthCheck();
  }

  /**
   * 測試數據庫連接
   */
  static async testConnection(provider) {
    try {
      const originalProvider = databaseManager.getProvider();
      
      if (provider && provider !== originalProvider) {
        await databaseManager.switchDatabase(provider);
      }
      
      const isHealthy = await databaseManager.healthCheck();
      
      // 如果切換了provider，切換回原來的
      if (provider && provider !== originalProvider && originalProvider) {
        await databaseManager.switchDatabase(originalProvider);
      }
      
      return isHealthy;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * 測試所有可用的數據庫連接
   */
  static async testAllConnections() {
    const results = {
      mysql: false,
      mssql: false
    };

    console.log('🔍 Testing all database connections...');

    // 測試 MySQL
    try {
      results.mysql = await this.testConnection('mysql');
      console.log(`MySQL: ${results.mysql ? '✅ Connected' : '❌ Failed'}`);
    } catch (error) {
      console.log('MySQL: ❌ Failed');
    }

    // 測試 MSSQL
    try {
      results.mssql = await this.testConnection('mssql');
      console.log(`MSSQL: ${results.mssql ? '✅ Connected' : '❌ Failed'}`);
    } catch (error) {
      console.log('MSSQL: ❌ Failed');
    }

    return results;
  }

  /**
   * 優雅關閉數據庫連接
   */
  static async gracefulShutdown() {
    try {
      await databaseManager.disconnect();
      console.log('👋 Database connection closed gracefully');
    } catch (error) {
      console.error('💥 Error during graceful shutdown:', error);
    }
  }

  /**
   * 獲取數據庫統計信息
   */
  static async getDatabaseStats() {
    try {
      const provider = databaseManager.getProvider();
      if (!provider) {
        return { error: 'Database not initialized' };
      }

      const stats = {
        provider,
        isConnected: await databaseManager.healthCheck(),
        timestamp: new Date().toISOString()
      };

      // 嘗試獲取一些基本統計
      try {
        const gunCount = await databaseService.getGuns();
        const userCount = await databaseService.getUsers();
        const cpLogCount = await databaseService.getCpLogs();
        
        return {
          ...stats,
          counts: {
            guns: gunCount.length,
            users: userCount.length,
            cpLogs: cpLogCount.length
          }
        };
      } catch (error) {
        return {
          ...stats,
          counts: { error: 'Failed to fetch counts' }
        };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 執行數據庫遷移（如果需要）
   */
  static async runMigrations(provider) {
    // 這裡可以添加自動遷移邏輯
    console.log(`📊 Migrations for ${provider || 'current'} database would run here`);
    return true;
  }
}

export default DatabaseUtils;
