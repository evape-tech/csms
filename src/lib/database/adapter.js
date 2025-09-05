import { PrismaClient as MySQLClient } from '../../../prisma-clients/mysql/index.js';
import { PrismaClient as MSSQLClient } from '../../../prisma-clients/mssql/index.js';

class DatabaseManager {
  constructor() {
    this.adapter = null;
    this.isInitialized = false;
    this.initializationPromise = null; // 加入初始化鎖
  }

  async initialize(provider) {
    const dbProvider = provider || process.env.DB_PROVIDER || 'mysql';
    // 減少 debug log，提升效能
    // console.log(`🔍 [DatabaseManager] initialize() called with provider: ${provider}, env DB_PROVIDER: ${process.env.DB_PROVIDER}, final dbProvider: ${dbProvider}`);
    
    // 如果已經初始化且使用相同的provider，直接返回
    if (this.isInitialized && this.adapter?.provider === dbProvider) {
      // console.log(`✅ [DatabaseManager] Already initialized with ${dbProvider.toUpperCase()}, reusing connection`);
      return this.adapter.client;
    }

    // 如果正在初始化中，等待現有的初始化完成
    if (this.initializationPromise) {
      console.log(`⏳ [DatabaseManager] Initialization already in progress, waiting...`);
      await this.initializationPromise;
      if (this.adapter?.provider === dbProvider) {
        console.log(`✅ [DatabaseManager] Initialization completed, using ${dbProvider.toUpperCase()} connection`);
        return this.adapter.client;
      }
    }

    // 開始新的初始化流程，設置鎖
    this.initializationPromise = this._doInitialize(dbProvider);
    
    try {
      const result = await this.initializationPromise;
      return result;
    } finally {
      this.initializationPromise = null; // 清除鎖
    }
  }

  async _doInitialize(dbProvider) {
    // 斷開舊連接
    if (this.adapter) {
      console.log(`🔌 [DatabaseManager] Disconnecting from current ${this.adapter.provider.toUpperCase()} database`);
      await this.adapter.client.$disconnect();
    }

    try {
      if (dbProvider === 'mysql') {
        console.log(`🐬 [DatabaseManager] Creating MySQL client...`);
        console.log(`🔍 [DatabaseManager] About to create new MySQLClient()`);
        
        this.adapter = {
          client: new MySQLClient({
            log: ['warn', 'error'], // 移除 'query' 和 'info'，只保留警告和錯誤
          }),
          provider: 'mysql'
        };
        
        console.log(`🔍 [DatabaseManager] MySQLClient created successfully`);
      } else if (dbProvider === 'mssql') {
        console.log(`🗄️ [DatabaseManager] Creating MSSQL client...`);
        console.log(`🔍 [DatabaseManager] Using connection string: ${process.env.DATABASE_URL_MSSQL?.substring(0, 50)}...`);
        this.adapter = {
          client: new MSSQLClient({
            log: ['warn', 'error'], // 只保留警告和錯誤
          }),
          provider: 'mssql'
        };
      } else {
        throw new Error(`Unsupported database provider: ${dbProvider}`);
      }
      
      console.log(`🔗 [DatabaseManager] Connecting to ${dbProvider.toUpperCase()} database...`);
      await this.adapter.client.$connect();
      this.isInitialized = true;
      
      console.log(`✅ Database initialized with ${dbProvider.toUpperCase()}`);
      
      // 測試連接
      console.log(`🧪 [DatabaseManager] Testing ${dbProvider.toUpperCase()} connection...`);
      await this.adapter.client.$queryRaw`SELECT 1 as test`;
      console.log(`✅ [DatabaseManager] ${dbProvider.toUpperCase()} connection test successful`);
      
      return this.adapter.client;
    } catch (error) {
      console.error(`❌ Failed to initialize ${dbProvider.toUpperCase()} database:`, error);
      throw error;
    }
  }

  getClient() {
    if (!this.adapter || !this.isInitialized) {
      console.error(`❌ [DatabaseManager] getClient() called but database not initialized`);
      throw new Error('Database not initialized. Call initialize() first.');
    }
    // console.log(`📊 [DatabaseManager] getClient() returning ${this.adapter.provider.toUpperCase()} client`);
    return this.adapter.client;
  }

  getProvider() {
    return this.adapter?.provider || null;
  }

  async disconnect() {
    if (this.adapter && this.isInitialized) {
      try {
        await this.adapter.client.$disconnect();
        console.log(`✅ Disconnected from ${this.adapter.provider.toUpperCase()} database`);
      } catch (error) {
        console.error('❌ Error disconnecting from database:', error);
      } finally {
        this.adapter = null;
        this.isInitialized = false;
      }
    }
  }

  async switchDatabase(provider) {
    console.log(`🔄 [DatabaseManager] switchDatabase() called - switching from ${this.adapter?.provider || 'none'} to ${provider.toUpperCase()}`);
    
    await this.disconnect();
    await this.initialize(provider);
    
    console.log(`✅ Successfully switched to ${provider.toUpperCase()}`);
  }

  // 健康檢查
  async healthCheck() {
    if (!this.adapter || !this.isInitialized) {
      return false;
    }

    try {
      await this.adapter.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }
}

// 導出單例實例
const databaseManager = new DatabaseManager();

// 便利函數
async function getDatabase(provider) {
  return await databaseManager.initialize(provider);
}

function getDatabaseClient() {
  return databaseManager.getClient();
}

async function switchDatabase(provider) {
  return await databaseManager.switchDatabase(provider);
}

export {
  databaseManager,
  getDatabase,
  getDatabaseClient,
  switchDatabase
};
