/**
 * 账单和费率管理服务
 * billingService.js
 * 
 * 这个模块负责:
 * 1. 管理充电费率 (tariffs)
 * 2. 为充电交易生成账单记录 (billing_records)
 * 3. 基于不同费率类型计算费用
 * 4. 处理账单状态更新
 */

import { PrismaClient as MysqlClient } from '../../../prisma-clients/mysql';
import { PrismaClient as MssqlClient } from '../../../prisma-clients/mssql';
import logger from '../logger';

const mysqlClient = new MysqlClient();
const mssqlClient = new MssqlClient();

/**
 * 计费服务类
 */
class BillingService {
  constructor() {
    this.mysqlPrisma = mysqlClient;
    this.mssqlPrisma = mssqlClient;
  }

  /**
   * 获取当前活动的默认费率方案
   * @param {Object} options - 选项
   * @param {boolean} options.isAC - 是否为AC充电
   * @param {boolean} options.isDC - 是否为DC充电
   * @returns {Promise<Object>} 费率方案对象
   */
  async getDefaultTariff(options = {}) {
    const { isAC, isDC } = options;
    
    try {
      // 查询条件
      const where = { 
        is_active: true,
        is_default: true 
      };
      
      // 如果指定了充电类型，添加到过滤条件
      if (isAC) {
        where.ac_only = true;
        where.dc_only = false;
      } else if (isDC) {
        where.ac_only = false;
        where.dc_only = true;
      }

      // 从MySQL数据库查询
      const tariff = await this.mysqlPrisma.tariffs.findFirst({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // 同步查询MSSQL数据库
      const mssqlTariff = await this.mssqlPrisma.tariffs.findFirst({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // 确保两个数据库都有对应的记录，如果没有，同步数据
      if (tariff && !mssqlTariff) {
        await this.syncTariffToMssql(tariff.id);
      }

      return tariff;
    } catch (error) {
      logger.error(`获取默认费率方案失败: ${error.message}`);
      throw new Error(`获取默认费率方案失败: ${error.message}`);
    }
  }

  /**
   * 获取指定ID的费率方案
   * @param {number} id - 费率方案ID
   * @returns {Promise<Object>} 费率方案对象
   */
  async getTariffById(id) {
    try {
      const tariff = await this.mysqlPrisma.tariffs.findUnique({
        where: { id }
      });
      return tariff;
    } catch (error) {
      logger.error(`获取费率方案失败: ${error.message}`);
      throw new Error(`获取费率方案失败: ${error.message}`);
    }
  }

  /**
   * 创建新的费率方案
   * @param {Object} tariffData - 费率方案数据
   * @returns {Promise<Object>} 创建的费率方案
   */
  async createTariff(tariffData) {
    try {
      // 在MySQL中创建
      const tariff = await this.mysqlPrisma.tariffs.create({
        data: tariffData
      });
      
      // 同步到MSSQL
      await this.syncTariffToMssql(tariff.id);
      
      return tariff;
    } catch (error) {
      logger.error(`创建费率方案失败: ${error.message}`);
      throw new Error(`创建费率方案失败: ${error.message}`);
    }
  }

  /**
   * 更新费率方案
   * @param {number} id - 费率方案ID
   * @param {Object} tariffData - 费率方案更新数据
   * @returns {Promise<Object>} 更新后的费率方案
   */
  async updateTariff(id, tariffData) {
    try {
      // 在MySQL中更新
      const updatedTariff = await this.mysqlPrisma.tariffs.update({
        where: { id },
        data: tariffData
      });
      
      // 同步到MSSQL
      await this.syncTariffToMssql(id);
      
      return updatedTariff;
    } catch (error) {
      logger.error(`更新费率方案失败: ${error.message}`);
      throw new Error(`更新费率方案失败: ${error.message}`);
    }
  }

  /**
   * 删除费率方案
   * @param {number} id - 费率方案ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteTariff(id) {
    try {
      // 先检查是否有关联的账单
      const billingCount = await this.mysqlPrisma.billing_records.count({
        where: { tariff_id: id }
      });

      if (billingCount > 0) {
        throw new Error(`无法删除费率方案，已有${billingCount}笔账单使用此方案`);
      }

      // 在MySQL中删除
      await this.mysqlPrisma.tariffs.delete({
        where: { id }
      });
      
      // 在MSSQL中删除
      try {
        await this.mssqlPrisma.tariffs.delete({
          where: { id }
        });
      } catch (mssqlError) {
        logger.warn(`从MSSQL删除费率方案失败: ${mssqlError.message}`);
      }
      
      return { success: true, message: '费率方案已删除' };
    } catch (error) {
      logger.error(`删除费率方案失败: ${error.message}`);
      throw new Error(`删除费率方案失败: ${error.message}`);
    }
  }

  /**
   * 从MySQL同步费率方案到MSSQL
   * @param {number} id - 费率方案ID
   */
  async syncTariffToMssql(id) {
    try {
      // 从MySQL获取费率方案
      const tariff = await this.mysqlPrisma.tariffs.findUnique({
        where: { id }
      });

      if (!tariff) {
        throw new Error(`费率方案ID ${id} 不存在`);
      }

      // 将枚举转换为字符串 (MSSQL不支持枚举)
      const tariffTypeString = String(tariff.tariff_type);

      // 检查MSSQL是否已存在此费率方案
      const existingMssqlTariff = await this.mssqlPrisma.tariffs.findUnique({
        where: { id: tariff.id }
      });

      if (existingMssqlTariff) {
        // 更新
        await this.mssqlPrisma.tariffs.update({
          where: { id: tariff.id },
          data: {
            name: tariff.name,
            description: tariff.description,
            tariff_type: tariffTypeString, // 使用字符串版本
            base_price: tariff.base_price,
            service_fee: tariff.service_fee,
            minimum_fee: tariff.minimum_fee,
            peak_hours_start: tariff.peak_hours_start,
            peak_hours_end: tariff.peak_hours_end,
            peak_hours_price: tariff.peak_hours_price,
            off_peak_price: tariff.off_peak_price,
            weekend_price: tariff.weekend_price,
            tier1_max_kwh: tariff.tier1_max_kwh,
            tier1_price: tariff.tier1_price,
            tier2_max_kwh: tariff.tier2_max_kwh,
            tier2_price: tariff.tier2_price,
            tier3_price: tariff.tier3_price,
            discount_percentage: tariff.discount_percentage,
            promotion_code: tariff.promotion_code,
            valid_from: tariff.valid_from,
            valid_to: tariff.valid_to,
            ac_only: tariff.ac_only,
            dc_only: tariff.dc_only,
            membership_required: tariff.membership_required,
            is_active: tariff.is_active,
            is_default: tariff.is_default,
            created_by: tariff.created_by,
            updatedAt: new Date()
          }
        });
      } else {
        // 创建
        await this.mssqlPrisma.tariffs.create({
          data: {
            id: tariff.id,
            name: tariff.name,
            description: tariff.description,
            tariff_type: tariffTypeString, // 使用字符串版本
            base_price: tariff.base_price,
            service_fee: tariff.service_fee,
            minimum_fee: tariff.minimum_fee,
            peak_hours_start: tariff.peak_hours_start,
            peak_hours_end: tariff.peak_hours_end,
            peak_hours_price: tariff.peak_hours_price,
            off_peak_price: tariff.off_peak_price,
            weekend_price: tariff.weekend_price,
            tier1_max_kwh: tariff.tier1_max_kwh,
            tier1_price: tariff.tier1_price,
            tier2_max_kwh: tariff.tier2_max_kwh,
            tier2_price: tariff.tier2_price,
            tier3_price: tariff.tier3_price,
            discount_percentage: tariff.discount_percentage,
            promotion_code: tariff.promotion_code,
            valid_from: tariff.valid_from,
            valid_to: tariff.valid_to,
            ac_only: tariff.ac_only,
            dc_only: tariff.dc_only,
            membership_required: tariff.membership_required,
            is_active: tariff.is_active,
            is_default: tariff.is_default,
            created_by: tariff.created_by,
            createdAt: tariff.createdAt,
            updatedAt: tariff.updatedAt
          }
        });
      }

      logger.info(`费率方案 ID ${id} 已同步到 MSSQL`);
    } catch (error) {
      logger.error(`同步费率方案到 MSSQL 失败: ${error.message}`);
      throw new Error(`同步费率方案到 MSSQL 失败: ${error.message}`);
    }
  }

  /**
   * 为完成的充电交易生成账单
   * @param {string} transactionId - 交易ID
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 创建的账单记录
   */
  async generateBillingForTransaction(transactionId, options = {}) {
    try {
      // 获取交易记录
      const transaction = await this.mysqlPrisma.transactions.findUnique({
        where: { transaction_id: transactionId }
      });

      if (!transaction) {
        throw new Error(`交易 ${transactionId} 不存在`);
      }

      if (transaction.status !== 'COMPLETED' && transaction.status !== 'STOPPED') {
        throw new Error(`交易 ${transactionId} 未完成，无法生成账单`);
      }

      // 检查是否已存在账单
      const existingBilling = await this.mysqlPrisma.billing_records.findFirst({
        where: { transaction_id: transactionId }
      });

      if (existingBilling) {
        return existingBilling;
      }

      // 获取适用的费率方案
      const tariffId = options.tariffId;
      let tariff;
      
      if (tariffId) {
        tariff = await this.getTariffById(tariffId);
        if (!tariff) {
          throw new Error(`费率方案 ID ${tariffId} 不存在`);
        }
      } else {
        // 获取默认费率方案
        const isAC = transaction.cpid.includes('AC') || (await this.getChargerType(transaction.cpid, transaction.cpsn)) === 'AC';
        tariff = await this.getDefaultTariff({ isAC, isDC: !isAC });
      }

      if (!tariff) {
        throw new Error('未找到合适的费率方案');
      }

      // 计算费用
      const billing = await this.calculateBilling(transaction, tariff);

      // 保存账单记录到MySQL
      const billingRecord = await this.mysqlPrisma.billing_records.create({
        data: billing
      });

      // 同步到MSSQL
      await this.syncBillingToMssql(billingRecord.id);

      return billingRecord;
    } catch (error) {
      logger.error(`为交易生成账单失败: ${error.message}`);
      throw new Error(`为交易生成账单失败: ${error.message}`);
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
      const gun = await this.mysqlPrisma.guns.findFirst({
        where: {
          cpid,
          cpsn
        }
      });
      
      return gun?.acdc || 'AC'; // 默认为AC
    } catch (error) {
      logger.error(`获取充电桩类型失败: ${error.message}`);
      return 'AC'; // 出错时默认为AC
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
      let serviceFee = parseFloat(tariff.service_fee) || 0;
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

      // 确保不低于最低消费
      const minimumFee = parseFloat(tariff.minimum_fee) || 0;
      if (minimumFee > 0 && (energyFee + serviceFee) < minimumFee) {
        const originalTotal = energyFee + serviceFee;
        energyFee = minimumFee - serviceFee;
        
        billingDetails.minimumFeeApplied = true;
        billingDetails.originalTotal = originalTotal;
        billingDetails.minimumFee = minimumFee;
      }

      // 计算总额
      totalAmount = energyFee + serviceFee - discountAmount + taxAmount;

      return {
        transaction_id: transaction.transaction_id,
        transaction_ref: transaction.id,
        tariff_id: tariff.id,
        applied_price: appliedPrice,
        energy_consumed: energyConsumed,
        energy_fee: energyFee,
        service_fee: serviceFee,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        start_time: transaction.start_time,
        end_time: transaction.end_time,
        charging_duration: transaction.charging_duration || 0,
        billing_details: JSON.stringify(billingDetails),
        user_id: transaction.user_id,
        id_tag: transaction.id_tag,
        cpid: transaction.cpid,
        cpsn: transaction.cpsn,
        connector_id: transaction.connector_id,
        status: 'CALCULATED' // 使用字符串，兼容MSSQL
      };
    } catch (error) {
      logger.error(`计算账单金额失败: ${error.message}`);
      throw new Error(`计算账单金额失败: ${error.message}`);
    }
  }

  /**
   * 从MySQL同步账单记录到MSSQL
   * @param {number} id - 账单记录ID
   */
  async syncBillingToMssql(id) {
    try {
      // 从MySQL获取账单记录
      const billing = await this.mysqlPrisma.billing_records.findUnique({
        where: { id }
      });

      if (!billing) {
        throw new Error(`账单记录ID ${id} 不存在`);
      }
      
      // 将枚举转换为字符串 (MSSQL不支持枚举)
      const billingStatusString = String(billing.status);

      // 检查MSSQL是否已存在此账单记录
      const existingMssqlBilling = await this.mssqlPrisma.billing_records.findUnique({
        where: { id: billing.id }
      });

      if (existingMssqlBilling) {
        // 更新
        await this.mssqlPrisma.billing_records.update({
          where: { id: billing.id },
          data: {
            transaction_id: billing.transaction_id,
            transaction_ref: billing.transaction_ref,
            tariff_id: billing.tariff_id,
            applied_price: billing.applied_price,
            energy_consumed: billing.energy_consumed,
            energy_fee: billing.energy_fee,
            service_fee: billing.service_fee,
            discount_amount: billing.discount_amount,
            tax_amount: billing.tax_amount,
            total_amount: billing.total_amount,
            start_time: billing.start_time,
            end_time: billing.end_time,
            charging_duration: billing.charging_duration,
            billing_details: billing.billing_details,
            invoice_number: billing.invoice_number,
            invoice_issued_at: billing.invoice_issued_at,
            payment_method: billing.payment_method,
            payment_reference: billing.payment_reference,
            payment_time: billing.payment_time,
            user_id: billing.user_id,
            id_tag: billing.id_tag,
            cpid: billing.cpid,
            cpsn: billing.cpsn,
            connector_id: billing.connector_id,
            status: billingStatusString, // 使用字符串版本
            remark: billing.remark,
            updatedAt: new Date()
          }
        });
      } else {
        // 创建
        await this.mssqlPrisma.billing_records.create({
          data: {
            id: billing.id,
            transaction_id: billing.transaction_id,
            transaction_ref: billing.transaction_ref,
            tariff_id: billing.tariff_id,
            applied_price: billing.applied_price,
            energy_consumed: billing.energy_consumed,
            energy_fee: billing.energy_fee,
            service_fee: billing.service_fee,
            discount_amount: billing.discount_amount,
            tax_amount: billing.tax_amount,
            total_amount: billing.total_amount,
            start_time: billing.start_time,
            end_time: billing.end_time,
            charging_duration: billing.charging_duration,
            billing_details: billing.billing_details,
            invoice_number: billing.invoice_number,
            invoice_issued_at: billing.invoice_issued_at,
            payment_method: billing.payment_method,
            payment_reference: billing.payment_reference,
            payment_time: billing.payment_time,
            user_id: billing.user_id,
            id_tag: billing.id_tag,
            cpid: billing.cpid,
            cpsn: billing.cpsn,
            connector_id: billing.connector_id,
            status: billingStatusString, // 使用字符串版本
            remark: billing.remark,
            createdAt: billing.createdAt,
            updatedAt: billing.updatedAt
          }
        });
      }

      logger.info(`账单记录 ID ${id} 已同步到 MSSQL`);
    } catch (error) {
      logger.error(`同步账单记录到 MSSQL 失败: ${error.message}`);
      throw new Error(`同步账单记录到 MSSQL 失败: ${error.message}`);
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
      // 验证状态是否有效 - MySQL使用枚举，MSSQL使用字符串
      const validStatuses = ['PENDING', 'CALCULATED', 'INVOICED', 'PAID', 'CANCELLED', 'ERROR'];
      if (!validStatuses.includes(status)) {
        throw new Error(`无效的账单状态: ${status}`);
      }

      // 在MySQL中更新
      const updatedBilling = await this.mysqlPrisma.billing_records.update({
        where: { id },
        data: {
          status,
          ...additionalData,
          updatedAt: new Date()
        }
      });

      // 同步到MSSQL
      await this.syncBillingToMssql(id);

      return updatedBilling;
    } catch (error) {
      logger.error(`更新账单状态失败: ${error.message}`);
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
      const billings = await this.mysqlPrisma.billing_records.findMany({
        where,
        include: {
          tariff: {
            select: {
              name: true,
              tariff_type: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });

      // 获取总数
      const total = await this.mysqlPrisma.billing_records.count({ where });

      return {
        data: billings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`获取账单列表失败: ${error.message}`);
      throw new Error(`获取账单列表失败: ${error.message}`);
    }
  }
}

// 导出单例实例
const billingService = new BillingService();
export default billingService;
