import { NextResponse } from 'next/server';
import DatabaseUtils from './utils.js';

/**
 * 數據庫中間件 - 確保在處理請求前數據庫已初始化
 */
async function databaseMiddleware(request) {
  // 檢查數據庫是否已初始化
  const isHealthy = await DatabaseUtils.healthCheck();
  
  if (!isHealthy) {
    console.log('🔄 Database not healthy, attempting to initialize...');
    const initialized = await DatabaseUtils.initialize();
    
    if (!initialized) {
      console.error('💥 Failed to initialize database');
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }
  }

  return NextResponse.next();
}

/**
 * API路由包裝器 - 確保數據庫已初始化
 */
function withDatabase(handler) {
  return async (...args) => {
    try {
      // 確保數據庫已初始化
      const isHealthy = await DatabaseUtils.healthCheck();
      
      if (!isHealthy) {
        const initialized = await DatabaseUtils.initialize();
        if (!initialized) {
          return NextResponse.json(
            { error: 'Database connection failed' },
            { status: 500 }
          );
        }
      }

      return await handler(...args);
    } catch (error) {
      console.error('Database middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * 頁面包裝器 - 在服務器端確保數據庫已初始化
 */
function withDatabasePage(getServerSideProps) {
  return async (context) => {
    try {
      // 確保數據庫已初始化
      const isHealthy = await DatabaseUtils.healthCheck();
      
      if (!isHealthy) {
        await DatabaseUtils.initialize();
      }

      return await getServerSideProps(context);
    } catch (error) {
      console.error('Database page wrapper error:', error);
      return {
        props: {
          error: 'Database connection failed'
        }
      };
    }
  };
}

export {
  databaseMiddleware,
  withDatabase,
  withDatabasePage
};
