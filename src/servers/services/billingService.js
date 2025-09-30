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
      let tariff;
      
      if (tariffId) {
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
        // 根据枪的tariff关联获取费率方案
        const gunId = await this.getGunIdFromCpidCpsn(transaction.cpid, transaction.cpsn);
        tariff = await this.tariffRepository.getTariffForGun(gunId);
        
        if (!tariff) {
          // 如果没有找到枪的tariff关联，使用默认费率方案
          const isAC = transaction.cpid.includes('AC') || (await this.getChargerType(transaction.cpid, transaction.cpsn)) === 'AC';
          tariff = await this.tariffRepository.getDefaultTariff({ isAC, isDC: !isAC });
        }
      }

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

      // 保存账单记录
      const billingRecord = await this.databaseService.createBillingRecord(billing);

      if (autoMode) {
        console.info(`[自动计费] 已为交易 ${transactionId} 生成账单记录 #${billingRecord.id}`);
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

      const energyConsumed = parseFloat(transaction.energy_consumed);
      let appliedPrice = parseFloat(tariff.base_price);
      let energyFee = 0;
      let serviceFee = 0;
      let discountAmount = 0;
      let taxAmount = 0;
      let totalAmount = 0;
      let billingDetails = {};

      // 根据不同费率类型计算
      switch (tariff.tariff_type) {
        case 'FIXED_RATE':
          // 固定费率
          energyFee = energyConsumed * appliedPrice;
          billingDetails = {
            rateType: 'FIXED_RATE',
            unitPrice: appliedPrice,
            calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
          };
          break;

        case 'TIME_OF_USE':
          // 分时费率 (这里简化处理，实际应按照充电的具体时段分别计费)
          const chargingStartHour = transaction.start_time.getHours();
          const chargingEndHour = transaction.end_time.getHours();
          
          const peakStartHour = parseInt(tariff.peak_hours_start?.split(':')[0] || '9');
          const peakEndHour = parseInt(tariff.peak_hours_end?.split(':')[0] || '18');
          
          // 简化计算，检查是否在尖峰时段
          const isPeakTime = (chargingStartHour >= peakStartHour && chargingStartHour < peakEndHour);
          
          if (isPeakTime) {
            appliedPrice = parseFloat(tariff.peak_hours_price) || appliedPrice;
            billingDetails.rateType = 'PEAK_HOURS';
          } else {
            appliedPrice = parseFloat(tariff.off_peak_price) || appliedPrice;
            billingDetails.rateType = 'OFF_PEAK_HOURS';
          }
          
          energyFee = energyConsumed * appliedPrice;
          billingDetails = {
            ...billingDetails,
            unitPrice: appliedPrice,
            timeFrame: isPeakTime ? '尖峰时段' : '离峰时段',
            calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
          };
          break;

        case 'PROGRESSIVE':
          // 累进费率
          const tier1Max = parseFloat(tariff.tier1_max_kwh) || 0;
          const tier2Max = parseFloat(tariff.tier2_max_kwh) || 0;
          const tier1Price = parseFloat(tariff.tier1_price) || appliedPrice;
          const tier2Price = parseFloat(tariff.tier2_price) || appliedPrice;
          const tier3Price = parseFloat(tariff.tier3_price) || appliedPrice;
          
          let remainingEnergy = energyConsumed;
          let tier1Energy = 0;
          let tier2Energy = 0;
          let tier3Energy = 0;
          let tier1Cost = 0;
          let tier2Cost = 0;
          let tier3Cost = 0;
          
          if (remainingEnergy > 0 && tier1Max > 0) {
            tier1Energy = Math.min(remainingEnergy, tier1Max);
            tier1Cost = tier1Energy * tier1Price;
            remainingEnergy -= tier1Energy;
          }
          
          if (remainingEnergy > 0 && tier2Max > tier1Max) {
            tier2Energy = Math.min(remainingEnergy, tier2Max - tier1Max);
            tier2Cost = tier2Energy * tier2Price;
            remainingEnergy -= tier2Energy;
          }
          
          if (remainingEnergy > 0) {
            tier3Energy = remainingEnergy;
            tier3Cost = tier3Energy * tier3Price;
          }
          
          energyFee = tier1Cost + tier2Cost + tier3Cost;
          appliedPrice = energyFee / energyConsumed; // 平均单价
          
          billingDetails = {
            rateType: 'PROGRESSIVE',
            tiers: [
              { maxKwh: tier1Max, price: tier1Price, energy: tier1Energy, cost: tier1Cost },
              { maxKwh: tier2Max, price: tier2Price, energy: tier2Energy, cost: tier2Cost },
              { price: tier3Price, energy: tier3Energy, cost: tier3Cost }
            ],
            calculation: `阶梯1: ${tier1Energy.toFixed(2)} kWh × ${tier1Price} = ${tier1Cost.toFixed(2)}\n` +
                         `阶梯2: ${tier2Energy.toFixed(2)} kWh × ${tier2Price} = ${tier2Cost.toFixed(2)}\n` +
                         `阶梯3: ${tier3Energy.toFixed(2)} kWh × ${tier3Price} = ${tier3Cost.toFixed(2)}\n` +
                         `总计: ${energyFee.toFixed(2)}`
          };
          break;

        case 'SPECIAL_PROMOTION':
        case 'MEMBERSHIP':
          // 特殊促销或会员费率
          energyFee = energyConsumed * appliedPrice;
          
          // 应用折扣
          if (tariff.discount_percentage && tariff.discount_percentage > 0) {
            discountAmount = (energyFee * parseFloat(tariff.discount_percentage)) / 100;
            energyFee -= discountAmount;
          }
          
          billingDetails = {
            rateType: tariff.tariff_type,
            unitPrice: appliedPrice,
            discountPercentage: tariff.discount_percentage,
            originalAmount: energyConsumed * appliedPrice,
            discountAmount,
            calculation: `${energyConsumed} kWh × ${appliedPrice} = ${(energyConsumed * appliedPrice).toFixed(2)}\n` +
                         `折扣: ${tariff.discount_percentage}% = ${discountAmount.toFixed(2)}\n` +
                         `折后金额: ${energyFee.toFixed(2)}`
          };
          break;

        default:
          // 自定义费率或其他
          energyFee = energyConsumed * appliedPrice;
          billingDetails = {
            rateType: 'CUSTOM',
            unitPrice: appliedPrice,
            calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
          };
      }
      
      // 计算总额
      totalAmount = energyFee + serviceFee - discountAmount + taxAmount;

      return {
        transaction_id: transaction.transaction_id,
        tariff_id: tariff.id,
        applied_price: appliedPrice,
        energy_consumed: energyConsumed,
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
