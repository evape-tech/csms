import { getDatabaseClient } from './adapter.js';

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
    // console.log(`🔍 [DatabaseService] getGuns() called with filter:`, filter);
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
  // Transactions Operations
  // ===============================
  
  async createTransaction(data) {
    const client = getDatabaseClient();
    return await client.transactions.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getTransactions(filter) {
    const client = getDatabaseClient();
    // 支援複雜查詢條件，如時間範圍查詢
    return await client.transactions.findMany({ 
      where: filter,
      orderBy: { start_time: 'desc' }
    });
  }

  async getTransaction(transactionId) {
    const client = getDatabaseClient();
    return await client.transactions.findUnique({ 
      where: { transaction_id: transactionId } 
    });
  }

  // 根據 OCPP 整數 ID 查找交易 (新增函數，主鍵查詢)
  async getTransactionById(ocppTransactionId) {
    const client = getDatabaseClient();
    return await client.transactions.findUnique({ 
      where: { id: BigInt(ocppTransactionId) } 
    });
  }

  async updateTransaction(transactionId, data) {
    const client = getDatabaseClient();
    return await client.transactions.update({ 
      where: { transaction_id: transactionId }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  // 根據 OCPP 整數 ID 更新交易 (新增函數，主鍵更新)
  async updateTransactionById(ocppTransactionId, data) {
    const client = getDatabaseClient();
    return await client.transactions.update({ 
      where: { id: BigInt(ocppTransactionId) }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteTransaction(transactionId) {
    const client = getDatabaseClient();
    return await client.transactions.delete({ 
      where: { transaction_id: transactionId } 
    });
  }

  // ===============================
// Station Operations
// ===============================

  async getStations() {
    const client = getDatabaseClient();
    // 獲取所有場域及其相關的電表資訊
    const stations = await client.stations.findMany({
      include: {
        meters: {
          include: {
            guns: true
          }
        },
        tariff: true
      }
    });
    return stations;
  }

  async getStationById(id) {
    const client = getDatabaseClient();
    return await client.stations.findUnique({
      where: { id: parseInt(id) },
      include: {
        meters: {
          include: {
            guns: true
          }
        },
        tariff: true
      }
    });
  }

  async updateStation(id, data) {
    const client = getDatabaseClient();
    // 更新場域基本資訊
    return await client.stations.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        updated_at: new Date()
      },
      include: {
        meters: {
          include: {
            guns: true
          }
        },
        tariff: true
      }
    });
  }

  async createStation(data) {
    const client = getDatabaseClient();
    return await client.stations.create({
      data: {
        ...data,
        updated_at: new Date()
      },
      include: {
        meters: {
          include: {
            guns: true
          }
        },
        tariff: true
      }
    });
  }

  // ===============================
// Meter Operations
// ===============================

  async getMeters(stationId = null) {
    const client = getDatabaseClient();
    const where = stationId ? { station_id: parseInt(stationId) } : {};
    return await client.meters.findMany({
      where,
      include: {
        station: true,
        guns: true
      },
      orderBy: { updated_at: 'desc' }
    });
  }

  async getMeterById(id) {
    const client = getDatabaseClient();
    return await client.meters.findUnique({
      where: { id: parseInt(id) },
      include: {
        station: true,
        guns: true
      }
    });
  }

  async updateMeter(id, data) {
    const client = getDatabaseClient();
    return await client.meters.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        updated_at: new Date()
      },
      include: {
        station: true,
        guns: true
      }
    });
  }

  async createMeter(data) {
    const client = getDatabaseClient();
    return await client.meters.create({
      data: {
        ...data,
        updated_at: new Date()
      },
      include: {
        station: true,
        guns: true
      }
    });
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

  // ===============================
  // Tariffs Operations
  // ===============================

  async createTariff(data) {
    const client = getDatabaseClient();
    return await client.tariffs.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getTariffs(filter = {}) {
    const client = getDatabaseClient();
    return await client.tariffs.findMany({
      where: filter,
      orderBy: [
        { is_default: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
  }

  async getTariffById(id) {
    const client = getDatabaseClient();
    return await client.tariffs.findUnique({
      where: { id: parseInt(id) }
    });
  }

  async updateTariff(id, data) {
    const client = getDatabaseClient();
    return await client.tariffs.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteTariff(id) {
    const client = getDatabaseClient();
    return await client.tariffs.delete({
      where: { id: parseInt(id) }
    });
  }

  // ===============================
  // Billing Records Operations
  // ===============================

  async createBillingRecord(data) {
    const client = getDatabaseClient();
    return await client.billing_records.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getBillingRecords(filter = {}) {
    const client = getDatabaseClient();
    return await client.billing_records.findMany({
      where: filter,
      include: {
        tariff: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBillingRecordById(id) {
    const client = getDatabaseClient();
    return await client.billing_records.findUnique({
      where: { id: BigInt(id) },
      include: {
        tariff: true
      }
    });
  }

  async updateBillingRecord(id, data) {
    const client = getDatabaseClient();
    return await client.billing_records.update({
      where: { id: BigInt(id) },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteBillingRecord(id) {
    const client = getDatabaseClient();
    return await client.billing_records.delete({
      where: { id: BigInt(id) }
    });
  }

  async getUnbilledCompletedTransactions(limit = 50) {
    const client = getDatabaseClient();
    
    // 查找已完成但未生成帳單的交易
    return await client.transactions.findMany({
      where: {
        status: 'COMPLETED',
        end_time: { not: null },
        energy_consumed: { gt: 0 },
        // 不存在對應的帳單記錄
        NOT: {
          transaction_id: {
            in: client.billing_records.findMany({
              select: { transaction_id: true }
            }).then(records => records.map(r => r.transaction_id))
          }
        }
      },
      orderBy: { end_time: 'asc' },
      take: limit
    });
  }
}

// 導出單例實例
const databaseService = new DatabaseService();

export {
  DatabaseService,
  databaseService
};
