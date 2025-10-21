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
    return await client.guns.findMany({ 
      where: filter,
      include: {
        gun_tariffs: {
          include: {
            tariffs: true
          },
          orderBy: { priority: 'asc' }
        },
        charging_standards: true
      }
    });
  }

  async getGunById(id) {
    const client = getDatabaseClient();
    return await client.guns.findUnique({ 
      where: { id },
      include: {
        gun_tariffs: {
          include: {
            tariffs: true
          },
          orderBy: { priority: 'asc' }
        },
        charging_standards: true
      }
    });
  }

  async getGunByCpsn(cpsn) {
    const client = getDatabaseClient();
    return await client.guns.findFirst({ 
      where: { cpsn },
      include: {
        gun_tariffs: {
          include: {
            tariffs: true
          },
          orderBy: { priority: 'asc' }
        },
        charging_standards: true
      }
    });
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
    // 數字 ID 或可轉換為數字的字串
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return await client.users.findUnique({ where: { id: numericId } });
  }

  async getUserByUuid(uuid) {
    const client = getDatabaseClient();
    // 使用 UUID/nanoid 字串查詢
    return await client.users.findUnique({ where: { uuid } });
  }

  async getUserByEmail(email) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] getUserByEmail() called with email: ${email}`);
    // Use findFirst instead of findUnique because 'email' may not be a unique field across schemas
    return await client.users.findFirst({ where: { email } });
  }

  async getUserByPhone(phone) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] getUserByPhone() called with phone: ${phone}`);
    return await client.users.findFirst({ where: { phone } });
  }

  async getUserByRfidCard(cardNumber) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] getUserByRfidCard() called with cardNumber: ${cardNumber}`);
    
    // 查找RFID卡片及其關聯的用戶
    const rfidCard = await client.rfid_cards.findFirst({
      where: { 
        card_number: cardNumber,
        status: 'ACTIVE' // 只查找啟用的卡片
      },
      include: {
        users: true // 包含關聯的用戶信息
      }
    });
    
    if (!rfidCard) {
      console.log(`🔍 [DatabaseService] RFID卡片不存在或未啟用: ${cardNumber}`);
      return null;
    }
    
    // 更新卡片的最後使用時間
    await client.rfid_cards.update({
      where: { id: rfidCard.id },
      data: { last_used_at: new Date() }
    });
    
    console.log(`🔍 [DatabaseService] 找到RFID卡片用戶: ${rfidCard.users.email} (UUID: ${rfidCard.users.uuid})`);
    return rfidCard.users;
  }

  async updateUser(id, data) {
    const client = getDatabaseClient();
    // 數字 ID 或可轉換為數字的字串
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return await client.users.update({ 
      where: { id: numericId }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async updateUserByUuid(uuid, data) {
    const client = getDatabaseClient();
    // 使用 UUID/nanoid 字串查詢
    return await client.users.update({ 
      where: { uuid }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteUser(id) {
    const client = getDatabaseClient();
    // 數字 ID 或可轉換為數字的字串
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return await client.users.delete({ where: { id: numericId } });
  }

  async deleteUserByUuid(uuid) {
    const client = getDatabaseClient();
    // 使用 UUID/nanoid 字串查詢
    return await client.users.delete({ where: { uuid } });
  }

  // OTP 相關操作
  async updateUserOTP(uuid, otpCode, otpExpiresAt) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] updateUserOTP() for UUID: ${uuid}`);
    return await client.users.updateMany({
      where: { uuid },
      data: {
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        failed_login_attempts: 0, // 重置失敗次數
        updatedAt: new Date()
      }
    });
  }

  async incrementFailedAttempts(uuid) {
    const client = getDatabaseClient();
    const user = await client.users.findFirst({ where: { uuid } });
    if (!user) return null;
    
    return await client.users.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: (user.failed_login_attempts || 0) + 1,
        updatedAt: new Date()
      }
    });
  }

  async updateUserAfterOTPVerification(uuid) {
    const client = getDatabaseClient();
    console.log(`🔍 [DatabaseService] updateUserAfterOTPVerification() for UUID: ${uuid}`);
    
    const user = await client.users.findFirst({ where: { uuid } });
    if (!user) return null;

    return await client.users.update({
      where: { id: user.id },
      data: {
        phone_verified: true,
        account_status: 'ACTIVE',
        otp_code: null,
        otp_expires_at: null,
        failed_login_attempts: 0,
        last_login_at: new Date(),
        login_count: (user.login_count || 0) + 1,
        updatedAt: new Date()
      }
    });
  }

  async cleanupExpiredOTPs() {
    const client = getDatabaseClient();
    const now = new Date();
    return await client.users.updateMany({
      where: {
        otp_expires_at: { lt: now },
        otp_code: { not: null }
      },
      data: {
        otp_code: null,
        otp_expires_at: null,
        updatedAt: new Date()
      }
    });
  }

  // 獲取用戶的所有RFID卡片
  async getUserRfidCards(userUuid) {
    const client = getDatabaseClient();
    
    try {
      // 先通過UUID找到用戶ID
      const user = await client.users.findFirst({
        where: { uuid: userUuid }
      });
      
      if (!user) {
        console.log('🔍 [DatabaseService] getUserRfidCards: 找不到用戶 UUID:', userUuid);
        return [];
      }
      
      // 查找用戶的所有啟用RFID卡片
      const rfidCards = await client.rfid_cards.findMany({
        where: {
          user_id: user.id,
          is_active: true
        },
        orderBy: {
          created_at: 'desc' // 最新的卡片優先
        }
      });
      
      console.log(`🔍 [DatabaseService] getUserRfidCards: 用戶 ${userUuid} 有 ${rfidCards.length} 張啟用的RFID卡片`);
      return rfidCards;
      
    } catch (error) {
      console.error('🔍 [DatabaseService] getUserRfidCards error:', error);
      return [];
    }
  }

  // ===============================
  // Transactions Operations
  // ===============================
  
  async createTransaction(data) {
    const client = getDatabaseClient();
    return await client.charging_transactions.create({ 
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
    return await client.charging_transactions.findMany({ 
      where: filter,
      orderBy: { start_time: 'desc' }
    });
  }

  async getTransaction(transactionId) {
    const client = getDatabaseClient();
    return await client.charging_transactions.findUnique({ 
      where: { transaction_id: transactionId } 
    });
  }

  // 根據 OCPP 整數 ID 查找交易 (新增函數，主鍵查詢)
  async getTransactionById(ocppTransactionId) {
    const client = getDatabaseClient();
    return await client.charging_transactions.findUnique({ 
      where: { id: BigInt(ocppTransactionId) } 
    });
  }

  async updateTransaction(transactionId, data) {
    const client = getDatabaseClient();
    return await client.charging_transactions.update({ 
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
    return await client.charging_transactions.update({ 
      where: { id: BigInt(ocppTransactionId) }, 
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteTransaction(transactionId) {
    const client = getDatabaseClient();
    return await client.charging_transactions.delete({ 
      where: { transaction_id: transactionId } 
    });
  }

  // ===============================
// Station Operations
// ===============================

  async getStations(filter = {}) {
    const client = getDatabaseClient();
    // 構建 where 條件，如果傳入 station_code 則只查詢符合的場域
    const where = {};
    if (filter.station_code) {
      // 支援 exact match 或可以擴展為包含/like
      where.station_code = filter.station_code;
    }

    // 獲取場域及其相關的電表與充電槍資訊（包含費率與充電標準）
    const stations = await client.stations.findMany({
      where,
      include: {
        meters: {
          include: {
            guns: {
              include: {
                gun_tariffs: {
                  include: {
                    tariffs: true
                  }
                },
                charging_standards: true
              }
            }
          }
        }
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
            guns: {
              include: {
                gun_tariffs: {
                  include: {
                    tariffs: true
                  }
                },
                charging_standards: true
              }
            }
          }
        }
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
            guns: {
              include: {
                gun_tariffs: {
                  include: {
                    tariffs: true
                  }
                }
              }
            }
          }
        }
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
            guns: {
              include: {
                gun_tariffs: {
                  include: {
                    tariffs: true
                  }
                }
              }
            }
          }
        }
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

  /**
   * 查詢特定充電槍的所有費率（返回完整列表，由前端判斷適用費率）
   * @param {number} gunId - 充電槍 ID
   * @param {boolean} activeOnly - 是否只查詢啟用的費率，預設 true
   * @returns {Promise<Array>} 費率列表（按優先級排序）
   */
  async getGunTariffs(gunId, activeOnly = true) {
    const client = getDatabaseClient();
    
    const where = {
      gun_id: parseInt(gunId),
      ...(activeOnly && { is_active: true })
    };

    const gunTariffs = await client.gun_tariffs.findMany({
      where,
      include: {
        tariffs: true
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // 只過濾啟用狀態和有效期，不過濾季節（讓前端自行判斷）
    const now = new Date();
    
    return gunTariffs
      .filter(gt => {
        const tariff = gt.tariffs;
        
        // 檢查費率是否啟用
        if (!tariff.is_active) return false;
        
        // 檢查 valid_from 和 valid_to（排除過期或未生效的費率）
        if (tariff.valid_from && new Date(tariff.valid_from) > now) return false;
        if (tariff.valid_to && new Date(tariff.valid_to) < now) return false;
        
        return true;
      })
      .map(gt => gt.tariffs);
  }

  /**
   * 根據 cpid 查詢充電槍的所有可用費率
   * @param {string} cpid - 充電樁 ID
   * @returns {Promise<Array>} 費率列表（由前端根據季節/時段選擇適用費率）
   */
  async getGunTariffsByCpid(cpid) {
    const client = getDatabaseClient();
    
    // 先找到對應的 gun
    const gun = await client.guns.findFirst({
      where: { cpid }
    });

    if (!gun) {
      return [];
    }

    // 返回該 gun 的所有可用費率
    return await this.getGunTariffs(gun.id, true);
  }

  // ===============================
  // Billing Records Operations
  // ===============================

  async createBillingRecord(data, prismaClient = null) {
    const client = prismaClient || getDatabaseClient();
    return await client.billing_records.create({ 
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async getUserWalletByUserId(userId, prismaClient = null) {
    const client = prismaClient || getDatabaseClient();
    return await client.user_wallets.findUnique({
      where: { user_id: userId }
    });
  }

  async updateUserWallet(id, data, prismaClient = null) {
    const client = prismaClient || getDatabaseClient();
    return await client.user_wallets.update({
      where: { id },
      data: {
        ...data,
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  async createWalletTransaction(data, prismaClient = null) {
    const client = prismaClient || getDatabaseClient();
    return await client.wallet_transactions.create({
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
        tariff: true,
        users: true
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
    return await client.charging_transactions.findMany({
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

  // ===============================
  // Gun Tariffs Operations (中間表操作)
  // ===============================

  async createGunTariff(data) {
    const client = getDatabaseClient();
    return await client.gun_tariffs.create({
      data: {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date()
      }
    });
  }

  /**
   * 查詢 gun_tariffs 關聯記錄（包含中間表資訊）
   * @param {number} gunId - 充電槍 ID
   * @returns {Promise<Array>} gun_tariffs 記錄陣列（包含 tariffs 關聯）
   */
  async getGunTariffAssociations(gunId) {
    const client = getDatabaseClient();
    return await client.gun_tariffs.findMany({
      where: { gun_id: gunId },
      include: {
        tariffs: true
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getGunTariffById(id) {
    const client = getDatabaseClient();
    return await client.gun_tariffs.findUnique({
      where: { id },
      include: {
        tariffs: true
      }
    });
  }

  async updateGunTariff(gunId, tariffId, data) {
    const client = getDatabaseClient();
    return await client.gun_tariffs.update({
      where: {
        gun_id_tariff_id: {
          gun_id: gunId,
          tariff_id: tariffId
        }
      },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async deleteGunTariff(gunId, tariffId) {
    const client = getDatabaseClient();
    try {
      await client.gun_tariffs.delete({
        where: {
          gun_id_tariff_id: {
            gun_id: gunId,
            tariff_id: tariffId
          }
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  async getActiveGunTariffs(gunId) {
    const client = getDatabaseClient();
    return await client.gun_tariffs.findMany({
      where: {
        gun_id: gunId,
        is_active: true
      },
      include: {
        tariffs: true
      },
      orderBy: { priority: 'asc' }
    });
  }

  async withTransaction(callback) {
    const client = getDatabaseClient();
    return await client.$transaction(async (prisma) => callback(prisma));
  }

  // ===============================
  // User Vehicles Operations
  // ===============================

  async getUserVehicles(userId, statusFilter = null) {
    const client = getDatabaseClient();
    const where = { user_id: userId };
    if (statusFilter) {
      where.status = statusFilter;
    }
    return await client.user_vehicles.findMany({
      where,
      include: {
        vehicle_brands: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserVehicleById(vehicleId) {
    const client = getDatabaseClient();
    return await client.user_vehicles.findUnique({
      where: { id: vehicleId },
      include: {
        vehicle_brands: true
      }
    });
  }

  async countUserVehicles(userId) {
    const client = getDatabaseClient();
    return await client.user_vehicles.count({
      where: { user_id: userId }
    });
  }

  async checkLicensePlateExists(licensePlate) {
    const client = getDatabaseClient();
    const result = await client.user_vehicles.findUnique({
      where: { license_plate: licensePlate }
    });
    return !!result;
  }

  async createUserVehicle(data) {
    const client = getDatabaseClient();
    return await client.user_vehicles.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        vehicle_brands: true
      }
    });
  }

  async deleteUserVehicle(vehicleId) {
    const client = getDatabaseClient();
    return await client.user_vehicles.delete({
      where: { id: vehicleId }
    });
  }

  async getVehicleBrands(activeOnly = true) {
    const client = getDatabaseClient();
    const where = activeOnly ? { is_active: true } : {};
    return await client.vehicle_brands.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  }

  async getVehicleBrandById(brandId) {
    const client = getDatabaseClient();
    return await client.vehicle_brands.findUnique({
      where: { id: brandId }
    });
  }

  // ===============================
  // Wallet Operations
  // ===============================

  async getUserWalletByUserId(userId) {
    const client = getDatabaseClient();
    return await client.user_wallets.findUnique({
      where: { user_id: userId }
    });
  }

  async createUserWallet(userId, initialBalance = 5000) {
    const client = getDatabaseClient();
    return await client.user_wallets.create({
      data: {
        user_id: userId,
        balance: initialBalance,
        currency: 'TWD',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  // ===============================
  // Transactions Operations
  // ===============================

  async getUserWalletTransactions(userId, limit = 50, offset = 0) {
    const client = getDatabaseClient();
    return await client.wallet_transactions.findMany({
      where: { user_id: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async countUserWalletTransactions(userId) {
    const client = getDatabaseClient();
    return await client.wallet_transactions.count({
      where: { user_id: userId }
    });
  }

  async getUserTopups(userId, limit = 50, offset = 0) {
    const client = getDatabaseClient();
    return await client.wallet_transactions.findMany({
      where: { 
        user_id: userId,
        transaction_type: 'DEPOSIT'
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async countUserTopups(userId) {
    const client = getDatabaseClient();
    return await client.wallet_transactions.count({
      where: { 
        user_id: userId,
        transaction_type: 'DEPOSIT'
      }
    });
  }

  async getWalletTransactionByChargingId(chargingTransactionId) {
    const client = getDatabaseClient();
    return await client.wallet_transactions.findFirst({
      where: { charging_transaction_id: chargingTransactionId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserChargingTransactions(userId, limit = 50, offset = 0) {
    const client = getDatabaseClient();
    return await client.charging_transactions.findMany({
      where: { user_id: userId },
      orderBy: { start_time: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async countUserChargingTransactions(userId) {
    const client = getDatabaseClient();
    return await client.charging_transactions.count({
      where: { user_id: userId }
    });
  }
}

// 導出單例實例
const databaseService = new DatabaseService();

export {
  DatabaseService,
  databaseService
};
