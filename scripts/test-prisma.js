const { PrismaClient } = require('../prisma-clients/mysql');

async function testPrisma() {
  console.log('🔍 Testing Prisma Client...');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
  
  try {
    console.log('📡 Attempting to connect via Prisma...');
    await prisma.$connect();
    console.log('✅ Prisma connected successfully!');
    
    console.log('🧪 Testing raw query via Prisma...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Prisma query test successful:', result);
    
  } catch (error) {
    console.error('❌ Prisma test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      clientVersion: error.clientVersion
    });
  } finally {
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected');
  }
}

testPrisma();
