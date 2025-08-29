// 數據庫初始化和設置腳本
const DatabaseUtils = require('../src/lib/database/utils');
const { databaseService } = require('../src/lib/database/service');

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...');
  
  try {
    // 測試所有連接
    console.log('📊 Testing database connections...');
    const connectionTests = await DatabaseUtils.testAllConnections();
    
    console.log('Connection Results:');
    console.log(`  MySQL: ${connectionTests.mysql ? '✅' : '❌'}`);
    console.log(`  MSSQL: ${connectionTests.mssql ? '✅' : '❌'}`);
    
    // 初始化默認數據庫
    const defaultProvider = process.env.DB_PROVIDER || 'mysql';
    console.log(`\n🔧 Initializing ${defaultProvider.toUpperCase()} as default database...`);
    
    const initialized = await DatabaseUtils.initialize(defaultProvider);
    
    if (initialized) {
      console.log('✅ Database initialized successfully!');
      
      // 獲取統計信息
      const stats = await DatabaseUtils.getDatabaseStats();
      console.log('\n📊 Database Statistics:');
      console.log(JSON.stringify(stats, null, 2));
      
      // 測試基本操作
      console.log('\n🧪 Testing basic database operations...');
      await testBasicOperations();
      
    } else {
      console.error('❌ Failed to initialize database');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Database initialization failed:', error);
    process.exit(1);
  } finally {
    // 優雅關閉
    await DatabaseUtils.gracefulShutdown();
    console.log('👋 Database connections closed');
  }
}

async function testBasicOperations() {
  try {
    // 測試讀取site settings
    const siteSettings = await databaseService.getSiteSettings();
    console.log(`✅ Site settings query: ${siteSettings ? 'Success' : 'No data'}`);
    
    // 測試讀取guns
    const guns = await databaseService.getGuns();
    console.log(`✅ Guns query: Found ${guns.length} records`);
    
    // 測試讀取users
    const users = await databaseService.getUsers();
    console.log(`✅ Users query: Found ${users.length} records`);
    
    console.log('🎉 All basic operations completed successfully!');
    
  } catch (error) {
    console.error('💥 Basic operations test failed:', error);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, testBasicOperations };
