/**
 * 费率管理服务
 * tariffService.js
 * 
 * 这个模块专门负责费率方案的 CRUD 操作:
 * 1. 创建费率方案
 * 2. 更新费率方案  
 * 3. 删除费率方案
 * 4. 查询费率方案
 * 5. 费率方案状态管理
 * 
 * 遵循单一职责原则，与 billingService 职责分离
 */

const { databaseService } = require('../../lib/database/service.js');

/**
 * 费率管理服务类
 */
class TariffService {
  constructor() {
    this.databaseService = databaseService;
  }

  /**
   * 获取当前活动的默认费率方案
   * @param {Object} options - 选项
   * @param {boolean} options.isAC - 是否为AC充电
   * @param {boolean} options.isDC - 是否为DC充电
   * @returns {Promise<Object>} 费率方案对象
   */
  async getDefaultTariff(options = {}) {
    try {
      const { isAC = false, isDC = false } = options;
      
      let whereClause = { 
        is_active: true, 
        is_default: true 
      };

      // 根据充电类型过滤
      if (isAC && !isDC) {
        whereClause.OR = [
          { ac_only: true, dc_only: false },
          { ac_only: false, dc_only: false }
        ];
      } else if (isDC && !isAC) {
        whereClause.OR = [
          { dc_only: true, ac_only: false },
          { ac_only: false, dc_only: false }
        ];
      }

      const defaultTariff = await this.databaseService.getDefaultTariff(whereClause);
      
      if (!defaultTariff) {
        throw new Error('没有找到默认费率方案');
      }
      
      return defaultTariff;
    } catch (error) {
      console.error(`获取默认费率方案失败: ${error.message}`);
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
      const tariff = await this.databaseService.getTariffById(id);
      return tariff;
    } catch (error) {
      console.error(`获取费率方案失败: ${error.message}`);
      throw new Error(`获取费率方案失败: ${error.message}`);
    }
  }

  /**
   * 获取指定充电枪的费率方案
   * @param {number} gunId - 充电枪ID
   * @returns {Promise<Object|null>} 费率方案对象
   */
  async getTariffForGun(gunId) {
    try {
      if (!gunId) {
        return null;
      }

      // 首先尝试获取充电枪特定的费率方案
      const gunTariff = await this.databaseService.getActiveGunTariffs(gunId);
      
      if (gunTariff && gunTariff.length > 0) {
        // 获取费率方案详情
        const tariff = await this.databaseService.getTariffById(gunTariff[0].tariff_id);
        return tariff;
      }
      
      // 如果没有特定费率，返回默认费率
      return await this.getDefaultTariff();
    } catch (error) {
      console.error(`获取充电枪费率方案失败: ${error.message}`);
      throw new Error(`获取充电枪费率方案失败: ${error.message}`);
    }
  }

  /**
   * 获取所有费率方案
   * @param {Object} options - 查询选项
   * @param {boolean} options.activeOnly - 是否只返回活动的费率
   * @returns {Promise<Array>} 费率方案列表
   */
  async getAllTariffs(options = {}) {
    try {
      const { activeOnly = false } = options;
      let whereClause = {};
      
      if (activeOnly) {
        whereClause.is_active = true;
      }
      
      const tariffs = await this.databaseService.getTariffs(whereClause);
      return tariffs;
    } catch (error) {
      console.error(`获取费率方案列表失败: ${error.message}`);
      throw new Error(`获取费率方案列表失败: ${error.message}`);
    }
  }

  /**
   * 创建新的费率方案
   * @param {Object} tariffData - 费率方案数据
   * @returns {Promise<Object>} 创建的费率方案
   */
  async createTariff(tariffData) {
    try {
      // 如果设置为默认费率，先取消其他默认费率
      if (tariffData.is_default) {
        await this.databaseService.updateTariffs(
          { is_default: true },
          { is_default: false }
        );
      }

      const tariff = await this.databaseService.createTariff(tariffData);
      return tariff;
    } catch (error) {
      console.error(`创建费率方案失败: ${error.message}`);
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
      // 如果设置为默认费率，先取消其他默认费率
      if (tariffData.is_default) {
        await this.databaseService.updateTariffs(
          { 
            is_default: true,
            id: { not: id }
          },
          { is_default: false }
        );
      }

      const updatedTariff = await this.databaseService.updateTariff(id, tariffData);
      return updatedTariff;
    } catch (error) {
      console.error(`更新费率方案失败: ${error.message}`);
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
      // 检查是否为默认费率
      const tariff = await this.getTariffById(id);
      if (tariff.is_default) {
        throw new Error('不能删除默认费率方案，请先设置其他费率为默认');
      }

      // 检查是否有相关的账单记录
      const billingRecords = await this.databaseService.getBillingRecordsByTariffId(id);
      if (billingRecords && billingRecords.length > 0) {
        throw new Error('该费率方案已被使用，不能删除');
      }

      const result = await this.databaseService.deleteTariff(id);
      return result;
    } catch (error) {
      console.error(`删除费率方案失败: ${error.message}`);
      throw new Error(`删除费率方案失败: ${error.message}`);
    }
  }

  /**
   * 切换费率方案状态
   * @param {number} id - 费率方案ID
   * @returns {Promise<Object>} 更新后的费率方案
   */
  async toggleTariffStatus(id) {
    try {
      const tariff = await this.getTariffById(id);
      const newStatus = !tariff.is_active;
      
      // 如果要停用默认费率，需要先检查
      if (tariff.is_default && !newStatus) {
        throw new Error('不能停用默认费率方案，请先设置其他费率为默认');
      }

      const updatedTariff = await this.updateTariff(id, { is_active: newStatus });
      return updatedTariff;
    } catch (error) {
      console.error(`切换费率方案状态失败: ${error.message}`);
      throw new Error(`切换费率方案状态失败: ${error.message}`);
    }
  }

  /**
   * 设置默认费率方案
   * @param {number} id - 费率方案ID
   * @returns {Promise<Object>} 更新后的费率方案
   */
  async setDefaultTariff(id) {
    try {
      // 先取消所有默认状态
      await this.databaseService.updateTariffs(
        { is_default: true },
        { is_default: false }
      );

      // 设置新的默认费率并激活
      const updatedTariff = await this.updateTariff(id, {
        is_default: true,
        is_active: true
      });
      
      return updatedTariff;
    } catch (error) {
      console.error(`设置默认费率方案失败: ${error.message}`);
      throw new Error(`设置默认费率方案失败: ${error.message}`);
    }
  }

  /**
   * 验证费率方案数据
   * @param {Object} tariffData - 费率方案数据
   * @returns {Object} 验证结果
   */
  validateTariffData(tariffData) {
    const errors = [];

    // 必填字段验证
    if (!tariffData.name || tariffData.name.trim() === '') {
      errors.push('费率方案名称不能为空');
    }

    if (!tariffData.tariff_type) {
      errors.push('费率类型不能为空');
    }

    if (tariffData.base_price === undefined || tariffData.base_price === null || tariffData.base_price < 0) {
      errors.push('基础价格必须大于等于0');
    }

    // 时段费率验证
    if (tariffData.tariff_type === 'TIME_OF_USE') {
      if (!tariffData.peak_hours_start || !tariffData.peak_hours_end) {
        errors.push('时段费率必须设置高峰时段');
      }
      if (tariffData.peak_hours_price === undefined || tariffData.peak_hours_price === null) {
        errors.push('时段费率必须设置高峰价格');
      }
      if (tariffData.off_peak_price === undefined || tariffData.off_peak_price === null) {
        errors.push('时段费率必须设置非高峰价格');
      }
    }

    // 阶梯费率验证
    if (tariffData.tariff_type === 'PROGRESSIVE') {
      if (!tariffData.tier1_max_kwh || !tariffData.tier1_price) {
        errors.push('阶梯费率必须设置第一阶段');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 导出单例实例
const tariffService = new TariffService();
module.exports = tariffService;
