import mysql from 'mysql2/promise';

/**
 * 設定資料庫用戶權限
 * csms_client 可以: SELECT, INSERT, UPDATE, DELETE (資料)
 * csms_client 不可以: DROP, CREATE, ALTER (表格結構)
 */

const config = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Evape!_!90072145',
  multipleStatements: true
};

async function setupPermissions() {
  console.log('🔧 Setting up database permissions for csms_client...\n');
  
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL as root\n');
    
    const databases = ['benson_csms_db', 'benson_csms_db_dev'];
    
    for (const dbName of databases) {
      console.log(`${'='.repeat(60)}`);
      console.log(`📋 Configuring permissions for: ${dbName}`);
      console.log(`${'='.repeat(60)}`);
      
      // 撤銷所有現有權限
      console.log('🔄 Revoking all existing privileges...');
      try {
        await connection.query(`REVOKE ALL PRIVILEGES ON ${dbName}.* FROM 'csms_client'@'%';`);
        console.log('✅ Revoked all privileges');
      } catch (err) {
        if (err.code !== 'ER_NONEXISTING_GRANT') {
          throw err;
        }
        console.log('ℹ️  No existing privileges to revoke');
      }
      
      // 授予資料操作權限 (可以讀寫資料)
      console.log('\n🔑 Granting data manipulation privileges:');
      const dataPrivileges = [
        'SELECT',   // 讀取資料
        'INSERT',   // 新增資料
        'UPDATE',   // 更新資料
        'DELETE',   // 刪除資料 (資料行，不是表格)
        'EXECUTE',  // 執行 stored procedures
        'SHOW VIEW' // 查看 views
      ];
      
      console.log(`   Allowed: ${dataPrivileges.join(', ')}`);
      
      await connection.query(
        `GRANT ${dataPrivileges.join(', ')} ON ${dbName}.* TO 'csms_client'@'%';`
      );
      console.log('✅ Data privileges granted');
      
      // 明確拒絕的權限 (不能修改表格結構)
      console.log('\n🚫 Explicitly denied privileges:');
      const deniedPrivileges = [
        'CREATE',      // 不能建立表格
        'DROP',        // 不能刪除表格
        'ALTER',       // 不能修改表格結構
        'INDEX',       // 不能建立/刪除索引
        'CREATE VIEW', // 不能建立 views
        'REFERENCES',  // 不能建立外鍵
        'TRIGGER'      // 不能建立 triggers
      ];
      console.log(`   Denied: ${deniedPrivileges.join(', ')}`);
      console.log('   (No explicit DENY needed - not granted = denied)');
      
      console.log('\n');
    }
    
    // 刷新權限
    console.log('🔄 Flushing privileges...');
    await connection.query('FLUSH PRIVILEGES;');
    console.log('✅ Privileges flushed\n');
    
    // 顯示最終權限
    console.log(`${'='.repeat(60)}`);
    console.log('📋 Final Grants for csms_client@%:');
    console.log(`${'='.repeat(60)}`);
    
    const [grants] = await connection.query("SHOW GRANTS FOR 'csms_client'@'%';");
    grants.forEach(grant => {
      console.log(`  ${Object.values(grant)[0]}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Permission setup completed successfully!');
    console.log('='.repeat(60));
    
    console.log('\n📌 Summary:');
    console.log('   ✅ Can SELECT (read data)');
    console.log('   ✅ Can INSERT (create new records)');
    console.log('   ✅ Can UPDATE (modify records)');
    console.log('   ✅ Can DELETE (remove records)');
    console.log('   ❌ Cannot DROP (delete tables)');
    console.log('   ❌ Cannot CREATE (create tables)');
    console.log('   ❌ Cannot ALTER (modify table structure)');
    console.log('   ❌ Cannot modify indexes, views, or triggers\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Code:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Make sure root password is correct');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 MySQL server is not running');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed\n');
    }
  }
}

setupPermissions();
