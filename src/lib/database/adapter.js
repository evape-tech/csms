import { PrismaClient as MySQLClient } from '../../../prisma-clients/mysql/index.js';

// 簡化的 MySQL 客戶端封裝 - 不再需要複雜的 adapter 類
const prisma = new MySQLClient({ log: ['warn', 'error'] });
let initialized = false;

async function initialize() {
  if (initialized) return prisma;
  try {
    console.log('� [DB] Connecting to MySQL...');
    await prisma.$connect();
    // quick health check
    await prisma.$queryRaw`SELECT 1 as test`;
    initialized = true;
    console.log('✅ [DB] MySQL connected');
    return prisma;
  } catch (err) {
    console.error('❌ [DB] Failed to initialize MySQL:', err);
    throw err;
  }
}

function getDatabaseClient() {
  if (!initialized) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return prisma;
}

async function disconnect() {
  if (!initialized) return;
  try {
    await prisma.$disconnect();
    initialized = false;
    console.log('✅ [DB] MySQL disconnected');
  } catch (err) {
    console.error('❌ [DB] Error during disconnect:', err);
  }
}

async function healthCheck() {
  try {
    if (!initialized) await initialize();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error('❌ [DB] Health check failed:', err);
    return false;
  }
}

function getProvider() {
  return 'mysql';
}

// 保留與舊介面相容的導出名稱
const databaseManager = {
  initialize,
  getClient: getDatabaseClient,
  getProvider,
  disconnect,
  healthCheck
};

async function getDatabase() {
  return await initialize();
}

async function switchDatabase(provider) {
  // 不支援切換，僅保留函式以維持相容性
  if (provider && provider !== 'mysql') {
    console.warn("switchDatabase: only 'mysql' is supported. Ignoring request.");
    return;
  }
  if (!initialized) await initialize();
}

export {
  databaseManager,
  getDatabase,
  getDatabaseClient,
  switchDatabase
};
