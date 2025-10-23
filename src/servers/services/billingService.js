/**
 * 账单服务
 * billingService.js
 * 
 * 这个模块专门负责账单相关功能:
 * 1. 为充电交易生成账单记录 (billing_records)
 * 2. 基于不同费率类型计算费用
 * 3. 处理账单状态更新
 * 4. 账单统计和查询
 * 
 * 费率管理已移至 tariffRepository.js 遵循单一职责原则
 * 本服务完全通过数据库抽象层操作，不直接依赖任何特定数据库客户端
 */

const { databaseService } = require('../../lib/database/service.js');
const { tariffRepository } = require('../repositories');
const { calculateRateByType } = require('../../lib/rateCalculator');

/**
 * 计费服务类
 */
class BillingService {
  constructor() {
    this.databaseService = databaseService;
    this.tariffRepository = tariffRepository;
  }

  /**
   * 为完成的充电交易生成账单
   * @param {string} transactionId - 交易ID
   * @param {Object} options - 可选参数
   * @param {number} options.tariffId - 指定费率方案ID
   * @param {boolean} options.autoMode - 是否为自动模式（不抛出错误）
   * @param {boolean} options.skipValidation - 跳过某些验证（如充电量检查）
   * @returns {Promise<Object|null>} 创建的账单记录，自动模式下失败返回null
   */
  async generateBillingForTransaction(transactionId, options = {}) {
    const { tariffId, autoMode = false, skipValidation = false } = options;
    
    try {
      // 获取交易记录（使用字串形式的 transaction_id）
      const transaction = await this.databaseService.getTransaction(transactionId);

      if (!transaction) {
        const error = `交易 ${transactionId} 不存在`;
        if (autoMode) {
          console.warn(`[自动计费] ${error}`);
          return null;
        }
        throw new Error(error);
      }

      // 检查交易状态
      if (!['COMPLETED', 'STOPPED', 'ERROR'].includes(transaction.status)) {
        const error = `交易 ${transactionId} 状态为 ${transaction.status}，无法生成账单`;
        if (autoMode) {
          console.debug(`[自动计费] ${error}`);
          return null;
        }
        throw new Error(error);
      }

      // 检查是否已存在账单
      const existingBillings = await this.databaseService.getBillingRecords({
        transaction_id: transactionId
      });

      if (existingBillings.length > 0) {
        if (autoMode) {
          console.debug(`[自动计费] 交易 ${transactionId} 已存在账单记录，跳过生成`);
        }
        return existingBillings[0];
      }

      // 检查充电量（只在自动模式下进行此检查）
      if (autoMode && !skipValidation) {
        if (!transaction.energy_consumed || parseFloat(transaction.energy_consumed) <= 0) {
          console.warn(`[自动计费] 交易 ${transactionId} 没有有效的充电量，不生成账单`);
          return null;
        }
      }

      // 获取适用的费率方案
      // 支持多種費率類型: FIXED_RATE, TIME_OF_USE, PROGRESSIVE, MEMBERSHIP, SPECIAL_PROMOTION
      let tariff;
      
      if (tariffId) {
        // 情況1: 手動指定費率方案ID
        tariff = await this.tariffRepository.getTariffById(tariffId);
        if (!tariff) {
          const error = `费率方案 ID ${tariffId} 不存在`;
          if (autoMode) {
            console.error(`[自动计费] ${error}`);
            return null;
          }
          throw new Error(error);
        }
      } else {
        // 情況2: 自動選擇費率方案
        // 步驟1: 取得該充電槍ID
        const gunId = await this.getGunIdFromCpidCpsn(transaction.cpid, transaction.cpsn);
        const chargingTime = transaction.start_time || new Date();
        
        // 步驟2: 根據充電槍和時間選擇費率
        // getTariffForGun 會自動處理：
        // - 充電槍綁定的費率列表（支持多種tariff_type）
        // - 根據充電時間過濾（有效期限 valid_from/valid_to）
        // - 季節匹配（season_start_month/season_end_month，如TIME_OF_USE）
        // - 優先級排序（priority欄位）
        // - 如果該槍沒有綁定費率，自動返回預設費率
        tariff = await this.tariffRepository.getTariffForGun(gunId, chargingTime);
        
        // 步驟3: 若仍未找到（理論上getTariffForGun最後會返回默認費率），額外安全檢查
        if (!tariff) {
          console.warn(`[計費] 交易 ${transactionId} 的充電槍 ${gunId} 未找到綁定費率，使用預設費率`);
          const isAC = transaction.cpid.includes('AC') || (await this.getChargerType(transaction.cpid, transaction.cpsn)) === 'AC';
          tariff = await this.tariffRepository.getDefaultTariff({ isAC, isDC: !isAC });
        }
      }

      // 最終檢查：確保有費率方案
      if (!tariff) {
        const error = '未找到合适的费率方案';
        if (autoMode) {
          console.error(`[自动计费] 交易 ${transactionId}: ${error}`);
          return null;
        }
        throw new Error(error);
      }

      // 计算费用
      const billing = await this.calculateBilling(transaction, tariff);
      const paymentTime = new Date();

      const billingData = {
        ...billing,
        status: 'PAID',
        payment_time: paymentTime,
        payment_reference: billing.payment_reference || transaction.transaction_id
      };

      const { billingRecord, walletTransaction, updatedWallet } = await this.databaseService.withTransaction(async (prisma) => {
        const createdBillingRecord = await this.createBillingRecordForTransaction(billingData, prisma);
        const walletResult = await this.applyWalletDeductionForBilling(
          transaction,
          createdBillingRecord,
          paymentTime,
          prisma
        );

        return {
          billingRecord: createdBillingRecord,
          ...walletResult
        };
      });

      if (autoMode) {
        console.info(
          `[自动计费] 已为交易 ${transactionId} 生成账单记录 #${billingRecord.id} 并完成钱包扣款 ${walletTransaction.amount.toString()}，余额 ${updatedWallet.balance.toString()}`
        );
      }

      return billingRecord;
    } catch (error) {
      const errorMsg = `为交易 ${transactionId} 生成账单失败: ${error.message}`;
      
      if (autoMode) {
        console.error(`[自动计费] ${errorMsg}`);
        return null;
      } else {
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * 建立交易的帳單紀錄
   * @param {Object} billingData - 需儲存的帳單資料
   * @param {Object} prisma - Prisma 交易客戶端
   * @returns {Promise<Object>} 新建立的帳單紀錄
   */
  async createBillingRecordForTransaction(billingData, prisma) {
    return await this.databaseService.createBillingRecord(billingData, prisma);
  }

  /**
   * 針對已產生的帳單進行錢包扣款與交易紀錄
   * @param {Object} transaction - 充電交易資料
   * @param {Object} billingRecord - 已建立的帳單紀錄
   * @param {Date} paymentTime - 扣款時間
   * @param {Object} prisma - Prisma 交易客戶端
   * @returns {Promise<{walletTransaction: Object, updatedWallet: Object}>}
   */
  async applyWalletDeductionForBilling(transaction, billingRecord, paymentTime, prisma) {
    if (!transaction.user_id) {
      throw new Error(`交易 ${transaction.transaction_id} 缺少用户信息，无法执行扣款`);
    }

    const userWallet = await this.databaseService.getUserWalletByUserId(transaction.user_id, prisma);

    if (!userWallet) {
      throw new Error(`用户 ${transaction.user_id} 未建立钱包，无法执行扣款`);
    }

    const walletBalance = parseFloat(userWallet.balance.toString());
    const totalAmount = parseFloat(billingRecord.total_amount.toString());
    const roundedWalletBalance = Math.round(walletBalance * 100) / 100;
    const roundedTotalAmount = Math.round(totalAmount * 100) / 100;

    if (roundedTotalAmount <= 0) {
      throw new Error(`交易 ${transaction.transaction_id} 账单金额无效 (${roundedTotalAmount})`);
    }

    if (roundedWalletBalance < roundedTotalAmount) {
      throw new Error(`用户 ${transaction.user_id} 钱包余额不足 (余额: ${roundedWalletBalance}, 所需: ${roundedTotalAmount})`);
    }

    const newBalance = Math.round((roundedWalletBalance - roundedTotalAmount) * 100) / 100;

    const updatedWalletRecord = await this.databaseService.updateUserWallet(
      userWallet.id,
      {
        balance: newBalance.toFixed(2),
        updatedAt: paymentTime
      },
      prisma
    );

    const createdWalletTransaction = await this.databaseService.createWalletTransaction(
      {
        user_id: transaction.user_id,
        wallet_id: userWallet.id,
        transaction_type: 'PAYMENT',
        amount: roundedTotalAmount.toFixed(2),
        balance_before: roundedWalletBalance.toFixed(2),
        balance_after: newBalance.toFixed(2),
        billing_record_id: billingRecord.id,
        charging_transaction_id: transaction.transaction_id,
        description: `充电交易扣款 - 交易 ${transaction.transaction_id}`,
        status: 'COMPLETED',
        createdAt: paymentTime,
        updatedAt: paymentTime
      },
      prisma
    );

    return {
      walletTransaction: createdWalletTransaction,
      updatedWallet: updatedWalletRecord
    };
  }

  /**
   * 获取充电桩类型 (AC/DC)
   * @param {string} cpid - 充电桩ID
   * @param {string} cpsn - 充电桩序号
   * @returns {Promise<string>} 充电桩类型 ('AC' 或 'DC')
   */
  async getChargerType(cpid, cpsn) {
    try {
      const guns = await this.databaseService.getGuns({
        cpid,
        cpsn
      });
      
      return guns.length > 0 ? (guns[0].acdc || 'AC') : 'AC'; // 默认为AC
    } catch (error) {
      console.error(`获取充电桩类型失败: ${error.message}`);
      return 'AC'; // 出错时默认为AC
    }
  }

  /**
   * 通过 CPID 和 CPSN 获取枪的ID
   * @param {string} cpid - 充电桩ID
   * @param {string} cpsn - 充电桩序号
   * @returns {Promise<number|null>} 枪的ID
   */
  async getGunIdFromCpidCpsn(cpid, cpsn) {
    try {
      const guns = await this.databaseService.getGuns({
        cpid,
        cpsn
      });
      
      return guns.length > 0 ? guns[0].id : null;
    } catch (error) {
      console.error(`获取枪ID失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 计算账单金额
   * @param {Object} transaction - 交易记录
   * @param {Object} tariff - 费率方案
   * @returns {Promise<Object>} 账单数据
   */
  async calculateBilling(transaction, tariff) {
    try {
      if (!transaction.energy_consumed) {
        throw new Error('交易缺少用电量数据，无法计算账单');
      }

      // 使用 rateCalculator 計算費用
      const { energyFee, appliedPrice, discountAmount, billingDetails } = calculateRateByType(transaction, tariff);
      
      // 其他費用項目
      const serviceFee = 0;
      const taxAmount = 0;
      
      // 计算总额
      const totalAmount = energyFee + serviceFee - discountAmount + taxAmount;

      return {
        transaction_id: transaction.transaction_id,
        tariff_id: tariff.id,
        applied_price: appliedPrice,
        energy_consumed: parseFloat(transaction.energy_consumed),
        energy_fee: energyFee,
        service_fee: serviceFee,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: 'TWD', // 新增的貨幣欄位，預設為台幣
        start_time: transaction.start_time,
        end_time: transaction.end_time,
        charging_duration: transaction.charging_duration || 0,
        billing_details: JSON.stringify(billingDetails),
        user_id: transaction.user_id,
        id_tag: transaction.id_tag,
        cpid: transaction.cpid,
        cpsn: transaction.cpsn,
        connector_id: transaction.connector_id,
        status: 'CALCULATED'
      };
    } catch (error) {
      console.error(`计算账单金额失败: ${error.message}`);
      throw new Error(`计算账单金额失败: ${error.message}`);
    }
  }

  /**
   * 更新账单状态
   * @param {number} id - 账单记录ID
   * @param {string} status - 新状态
   * @param {Object} additionalData - 额外更新数据
   * @returns {Promise<Object>} 更新后的账单记录
   */
  async updateBillingStatus(id, status, additionalData = {}) {
    try {
      // 验证状态是否有效
      const validStatuses = ['PENDING', 'CALCULATED', 'INVOICED', 'PAID', 'CANCELLED', 'ERROR'];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的账单状态: ${status}`);
      }

      // 更新账单状态
      const updatedBilling = await this.databaseService.updateBillingRecord(id, {
        status,
        ...additionalData,
        updated_at: new Date()
      });

      return updatedBilling;
    } catch (error) {
      console.error(`更新账单状态失败: ${error.message}`);
      throw new Error(`更新账单状态失败: ${error.message}`);
    }
  }

  /**
   * 生成账单列表
   * @param {Object} filters - 过滤条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise<Array>} 账单记录列表
   */
  async getBillingList(filters = {}, pagination = { page: 1, limit: 10 }) {
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      const where = {};

      // 构建过滤条件
      if (filters.transactionId) {
        where.transaction_id = { contains: filters.transactionId };
      }
      
      if (filters.userId) {
        where.user_id = { contains: filters.userId };
      }
      
      if (filters.idTag) {
        where.id_tag = { contains: filters.idTag };
      }
      
      if (filters.cpid) {
        where.cpid = { contains: filters.cpid };
      }
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.startDateFrom && filters.startDateTo) {
        where.start_time = {
          gte: new Date(filters.startDateFrom),
          lte: new Date(filters.startDateTo)
        };
      } else if (filters.startDateFrom) {
        where.start_time = { gte: new Date(filters.startDateFrom) };
      } else if (filters.startDateTo) {
        where.start_time = { lte: new Date(filters.startDateTo) };
      }

      // 查询数据
      const billings = await this.databaseService.getBillingRecords(where);

      // 獲取總數和分頁處理
      const total = billings.length;
      const paginatedBillings = billings.slice(skip, skip + limit);

      return {
        data: paginatedBillings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error(`获取账单列表失败: ${error.message}`);
      throw new Error(`获取账单列表失败: ${error.message}`);
    }
  }

  /**
   * 获取账单统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计信息
   */
  async getBillingStatistics(filters = {}) {
    try {
      const where = {};

      // 构建过滤条件
      if (filters.startDate && filters.endDate) {
        where.start_time = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate)
        };
      }

      if (filters.cpid) {
        where.cpid = filters.cpid;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      // 获取账单记录
      const billings = await this.databaseService.getBillingRecords(where);

      // 计算统计信息
      const totalRecords = billings.length;
      const totalAmount = billings.reduce((sum, billing) => sum + parseFloat(billing.total_amount || 0), 0);
      const totalEnergyConsumed = billings.reduce((sum, billing) => sum + parseFloat(billing.energy_consumed || 0), 0);
      const totalEnergyFee = billings.reduce((sum, billing) => sum + parseFloat(billing.energy_fee || 0), 0);
      const totalDiscountAmount = billings.reduce((sum, billing) => sum + parseFloat(billing.discount_amount || 0), 0);

      // 按状态分组统计
      const statusStats = {};
      billings.forEach(billing => {
        const status = billing.status || 'UNKNOWN';
        if (!statusStats[status]) {
          statusStats[status] = { count: 0, amount: 0 };
        }
        statusStats[status].count++;
        statusStats[status].amount += parseFloat(billing.total_amount || 0);
      });

      return {
        totalRecords,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        totalEnergyConsumed: parseFloat(totalEnergyConsumed.toFixed(2)),
        totalEnergyFee: parseFloat(totalEnergyFee.toFixed(2)),
        totalDiscountAmount: parseFloat(totalDiscountAmount.toFixed(2)),
        averageAmount: totalRecords > 0 ? parseFloat((totalAmount / totalRecords).toFixed(2)) : 0,
        averageEnergyConsumed: totalRecords > 0 ? parseFloat((totalEnergyConsumed / totalRecords).toFixed(2)) : 0,
        statusStats
      };
    } catch (error) {
      console.error(`获取账单统计信息失败: ${error.message}`);
      throw new Error(`获取账单统计信息失败: ${error.message}`);
    }
  }
}

// 导出单例实例
const billingService = new BillingService();
module.exports = billingService;
