import mysql from 'mysql2/promise';

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  const config = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'benson_csms_db' // 正確的資料庫名稱
  };
  
  try {
    console.log('📡 Attempting to connect to MySQL...');
    const connection = await mysql.createConnection(config);
    
    console.log('✅ Connected successfully!');
    
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', rows);
    
    await connection.end();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Suggestion: MySQL server is not running on localhost:3306');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Suggestion: Username/password incorrect');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Suggestion: Database does not exist');
    }
  }
}

testConnection();
