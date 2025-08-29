const { getDatabaseClient } = require('./adapter');

class DatabaseService {
  
  // ===============================
  // CP Logs Operations
  // ===============================
  
  async createCpLog(data) {
    const client = getDatabaseClient();
    return await client.cp_logs.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getCpLogs(filter) {
    const client = getDatabaseClient();
    return await client.cp_logs.findMany({ where: filter });
  }

  async getCpLogById(id) {
    const client = getDatabaseClient();
    return await client.cp_logs.findUnique({ where: { id: BigInt(id) } });
  }

  async updateCpLog(id, data) {
    const client = getDatabaseClient();
    return await client.cp_logs.update({ 
      where: { id: BigInt(id) }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteCpLog(id) {
    const client = getDatabaseClient();
    return await client.cp_logs.delete({ where: { id: BigInt(id) } });
  }

  // ===============================
  // Guns Operations
  // ===============================
  
  async createGun(data) {
    const client = getDatabaseClient();
    return await client.guns.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getGuns(filter) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] getGuns() called with filter:`, filter);
    return await client.guns.findMany({ where: filter });
  }

  async getGunById(id) {
    const client = getDatabaseClient();
    return await client.guns.findUnique({ where: { id } });
  }

  async getGunByCpsn(cpsn) {
    const client = getDatabaseClient();
    return await client.guns.findFirst({ where: { cpsn } });
  }

  async updateGun(id, data) {
    const client = getDatabaseClient();
    return await client.guns.update({ 
      where: { id }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteGun(id) {
    const client = getDatabaseClient();
    return await client.guns.delete({ where: { id } });
  }

  // ===============================
  // Users Operations
  // ===============================
  
  async createUser(data) {
    const client = getDatabaseClient();
    return await client.users.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getUsers(filter) {
    const client = getDatabaseClient();
    return await client.users.findMany({ where: filter });
  }

  async getUserById(id) {
    const client = getDatabaseClient();
    return await client.users.findUnique({ where: { id } });
  }

  async getUserByEmail(email) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] getUserByEmail() called with email: ${email}`);
    // Use findFirst instead of findUnique because 'email' may not be a unique field across schemas
    return await client.users.findFirst({ where: { email } });
  }

  async updateUser(id, data) {
    const client = getDatabaseClient();
    return await client.users.update({ 
      where: { id }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteUser(id) {
    const client = getDatabaseClient();
    return await client.users.delete({ where: { id } });
  }

  // ===============================
  // Site Settings Operations
  // ===============================
  
  async getSiteSettings() {
    const client = getDatabaseClient();
    const settings = await client.site_settings.findMany();
    return settings;
  }

  async updateSiteSettings(id, data) {
    const client = getDatabaseClient();
    // 嘗試更新，如果沒有記錄則創建
    // NOTE: site_settings model may include updatedAt mapped to DB column updated_at
    const existing = await this.getSiteSettings();
    if (existing && existing.length > 0) {
      // Include updatedAt timestamp when updating
      return await client.site_settings.update({ 
        where: { id: existing[0].id }, 
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new row using only provided fields and set updatedAt
      return await client.site_settings.create({ 
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    }
  }

  // ===============================
  // Raw Query Support
  // ===============================
  
  async executeRawQuery(query, ...params) {
    const client = getDatabaseClient();
    return await client.$queryRawUnsafe(query, ...params);
  }

  async executeRawTransaction(queries) {
    const client = getDatabaseClient();
    return await client.$transaction(
      queries.map(query => client.$queryRawUnsafe(query))
    );
  }
}

// 導出單例實例
const databaseService = new DatabaseService();

module.exports = {
  DatabaseService,
  databaseService
};
