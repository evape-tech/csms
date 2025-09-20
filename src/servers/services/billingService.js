/**
 * 計費服務
 * 處理充電交易的計費功能
 */

const logger = require('../utils/logger');
const { databaseService } = require('../../lib/database/service.js');

/**
 * 取得費率方案
 * @param {Object} whereClause 過濾條件
 * @returns {Promise<Array>} 費率方案列表
 */
async function getTariffs(whereClause = {}) {
  try {
    return await databaseService.getTariffs(whereClause);
  } catch (error) {
    logger.error(`取得費率方案失敗:`, error);
    throw error;
  }
}

/**
 * 根據槍的ID獲取適用的費率方案
 * @param {string} cpid - 充電樁ID
 * @param {string} cpsn - 充電樁序號
 * @returns {Promise<Object|null>} 費率方案對象或null
 */
async function getTariffForGun(cpid, cpsn) {
  try {
    // 首先找到對應的槍
    const gun = await databaseService.getGunByCpsn(cpsn);
    if (!gun) {
      return null;
    }

    // 獲取槍的活躍tariff關聯
    const gunTariffs = await databaseService.getActiveGunTariffs(gun.id);
    if (!gunTariffs || gunTariffs.length === 0) {
      return null;
    }

    // 返回優先級最高的活躍tariff
    return gunTariffs[0].tariffs;
  } catch (error) {
    logger.error(`獲取槍的費率方案失敗:`, error);
    return null;
  }
}

/**
 * 根據交易計算帳單
 * @param {Object} transaction 交易資料
 * @param {Object} [tariff] 指定的費率方案，如果不提供則使用預設方案
 * @returns {Promise<Object>} 計算好的帳單記錄
 */
async function calculateBill(transaction, tariff = null) {
  try {
    if (!transaction) {
      throw new Error('未提供交易資料');
    }

    if (!transaction.energy_consumed || transaction.energy_consumed <= 0) {
      logger.warn(`交易 ${transaction.transaction_id} 沒有耗電量記錄，無法計費`);
      return null;
    }

    // 如果沒有指定費率方案，使用預設方案
    if (!tariff) {
      tariff = await getDefaultTariff();
      if (!tariff) {
        throw new Error('找不到可用的費率方案');
      }
    }

    // 計算基本電費
    let energyConsumed = parseFloat(transaction.energy_consumed);
    let appliedPrice = parseFloat(tariff.base_price);
    let energyFee = 0;
    let serviceFee = 0; // 移除對 tariff.service_fee 的引用
    let discountAmount = 0;
    
    // 保存計費明細
    const billingDetails = {
      tariffName: tariff.name,
      tariffType: tariff.tariff_type,
      calculation: []
    };

    // 根據費率類型計算電費
    switch (tariff.tariff_type) {
      case 'FIXED_RATE':
        // 固定費率：單一價格
        energyFee = energyConsumed * appliedPrice;
        billingDetails.calculation.push({
          type: 'FIXED_RATE',
          kwh: energyConsumed,
          price: appliedPrice,
          amount: energyFee
        });
        break;
        
      case 'TIME_OF_USE':
        // 分時費率：需要分析充電發生的時段
        // 這裡僅實作簡化版，實際應用需要分析具體時段用量
        const startHour = new Date(transaction.start_time).getHours();
        const isPeak = isPeakHour(startHour, tariff.peak_hours_start, tariff.peak_hours_end);
        const isWeekend = isWeekendDay(new Date(transaction.start_time));
        
        if (isWeekend && tariff.weekend_price) {
          appliedPrice = parseFloat(tariff.weekend_price);
          billingDetails.calculation.push({
            type: 'WEEKEND',
            kwh: energyConsumed,
            price: appliedPrice,
            amount: energyConsumed * appliedPrice
          });
        } else if (isPeak && tariff.peak_hours_price) {
          appliedPrice = parseFloat(tariff.peak_hours_price);
          billingDetails.calculation.push({
            type: 'PEAK',
            kwh: energyConsumed,
            price: appliedPrice,
            amount: energyConsumed * appliedPrice
          });
        } else if (!isPeak && tariff.off_peak_price) {
          appliedPrice = parseFloat(tariff.off_peak_price);
          billingDetails.calculation.push({
            type: 'OFF_PEAK',
            kwh: energyConsumed,
            price: appliedPrice,
            amount: energyConsumed * appliedPrice
          });
        } else {
          // 使用基本價格
          billingDetails.calculation.push({
            type: 'DEFAULT',
            kwh: energyConsumed,
            price: appliedPrice,
            amount: energyConsumed * appliedPrice
          });
        }
        
        energyFee = energyConsumed * appliedPrice;
        break;
        
      case 'PROGRESSIVE':
        // 累進費率：根據用電量應用不同費率
        let remainingKwh = energyConsumed;
        energyFee = 0;
        
        // 第一階梯
        if (tariff.tier1_max_kwh && remainingKwh > 0) {
          const tier1Kwh = Math.min(remainingKwh, parseFloat(tariff.tier1_max_kwh));
          const tier1Price = parseFloat(tariff.tier1_price || tariff.base_price);
          const tier1Amount = tier1Kwh * tier1Price;
          
          energyFee += tier1Amount;
          remainingKwh -= tier1Kwh;
          
          billingDetails.calculation.push({
            type: 'TIER1',
            kwh: tier1Kwh,
            price: tier1Price,
            amount: tier1Amount
          });
        }
        
        // 第二階梯
        if (tariff.tier2_max_kwh && remainingKwh > 0) {
          const tier2Max = parseFloat(tariff.tier2_max_kwh);
          const tier1Max = parseFloat(tariff.tier1_max_kwh || 0);
          const tier2Limit = tier2Max - tier1Max;
          const tier2Kwh = Math.min(remainingKwh, tier2Limit);
          const tier2Price = parseFloat(tariff.tier2_price || tariff.base_price);
          const tier2Amount = tier2Kwh * tier2Price;
          
          energyFee += tier2Amount;
          remainingKwh -= tier2Kwh;
          
          billingDetails.calculation.push({
            type: 'TIER2',
            kwh: tier2Kwh,
            price: tier2Price,
            amount: tier2Amount
          });
        }
        
        // 第三階梯（或更高）
        if (remainingKwh > 0) {
          const tier3Price = parseFloat(tariff.tier3_price || tariff.base_price);
          const tier3Amount = remainingKwh * tier3Price;
          
          energyFee += tier3Amount;
          
          billingDetails.calculation.push({
            type: 'TIER3',
            kwh: remainingKwh,
            price: tier3Price,
            amount: tier3Amount
          });
        }
        
        // 這裡的 appliedPrice 是一個計算後的平均價格
        appliedPrice = energyFee / energyConsumed;
        break;
        
      case 'SPECIAL_PROMOTION':
      case 'MEMBERSHIP':
      case 'CUSTOM':
        // 其他方案基於基本費率，但可能包含折扣
        energyFee = energyConsumed * appliedPrice;
        
        // 處理折扣
        if (tariff.discount_percentage) {
          const discount = parseFloat(tariff.discount_percentage);
          discountAmount = energyFee * (discount / 100);
          energyFee -= discountAmount;
          
          billingDetails.calculation.push({
            type: 'DISCOUNT',
            percentage: discount,
            originalAmount: energyConsumed * appliedPrice,
            discountAmount: discountAmount,
            finalAmount: energyFee
          });
        } else {
          billingDetails.calculation.push({
            type: 'CUSTOM',
            kwh: energyConsumed,
            price: appliedPrice,
            amount: energyFee
          });
        }
        break;
        
      default:
        // 預設使用基本費率
        energyFee = energyConsumed * appliedPrice;
        billingDetails.calculation.push({
          type: 'DEFAULT',
          kwh: energyConsumed,
          price: appliedPrice,
          amount: energyFee
        });
    }
    
    // 移除最低消費金額處理邏輯
    
    // 計算總金額（電費 - 折扣）
    const totalAmount = energyFee + serviceFee - discountAmount;
    
    // 創建帳單記錄
    const billingRecord = {
      transaction_id: transaction.transaction_id,
      transaction_ref: transaction.id,
      tariff_id: tariff.id,
      applied_price: appliedPrice,
      energy_consumed: energyConsumed,
      energy_fee: energyFee,
      service_fee: serviceFee,
      discount_amount: discountAmount,
      tax_amount: 0,  // 稅金預設為 0，可根據需要調整
      total_amount: totalAmount,
      start_time: new Date(transaction.start_time),
      end_time: new Date(transaction.end_time || transaction.updatedAt),
      charging_duration: transaction.charging_duration || 0,
      billing_details: JSON.stringify(billingDetails),
      user_id: transaction.user_id,
      id_tag: transaction.id_tag,
      cpid: transaction.cpid,
      cpsn: transaction.cpsn,
      connector_id: transaction.connector_id,
      status: 'CALCULATED'
    };
    
    // 保存帳單記錄
    const savedBilling = await databaseService.createBillingRecord(billingRecord);
    logger.info(`交易 ${transaction.transaction_id} 的帳單已計算完成，總金額: ${totalAmount}元`);
    
    return savedBilling;
  } catch (error) {
    logger.error(`計算帳單失敗:`, error);
    throw error;
  }
}

/**
 * 為完成的交易生成帳單
 * @param {string} transactionId 交易ID
 * @returns {Promise<Object>} 生成的帳單記錄
 */
async function generateBillForTransaction(transactionId) {
  try {
    // 查詢交易記錄
    const transaction = await databaseService.getTransactionById(transactionId);
    
    if (!transaction) {
      throw new Error(`找不到交易記錄 ID: ${transactionId}`);
    }
    
    if (transaction.status !== 'COMPLETED') {
      throw new Error(`交易 ${transactionId} 尚未完成，無法生成帳單`);
    }
    
    // 檢查是否已有帳單記錄
    const existingBill = await databaseService.getBillingRecords({
      transaction_id: transaction.transaction_id
    });
    
    if (existingBill.length > 0) {
      logger.info(`交易 ${transaction.transaction_id} 已有帳單記錄，返回現有記錄`);
      return existingBill[0];
    }
    
    // 根據槍的tariff關聯獲取費率方案
    let tariff = await getTariffForGun(transaction.cpid, transaction.cpsn);
    if (!tariff) {
      // 如果沒有找到槍的tariff關聯，使用預設費率方案
      tariff = await getDefaultTariff();
    }
    
    if (!tariff) {
      throw new Error('找不到可用的費率方案');
    }
  } catch (error) {
    logger.error(`為交易生成帳單失敗:`, error);
    throw error;
  }
}

/**
 * 批次處理未計費的已完成交易
 * @param {number} batchSize 一次處理的數量
 * @returns {Promise<number>} 處理的交易數量
 */
async function processUnbilledTransactions(batchSize = 50) {
  try {
    // 查詢狀態為 COMPLETED 但未生成帳單的交易
    const transactions = await databaseService.getUnbilledCompletedTransactions(batchSize);
    
    logger.info(`找到 ${transactions.length} 筆未計費的已完成交易`);
    
    let processedCount = 0;
    
    // 批次處理交易
    for (const transaction of transactions) {
      try {
        // 檢查是否有足夠資料計算帳單
        if (!transaction.energy_consumed || transaction.energy_consumed <= 0) {
          logger.warn(`交易 ${transaction.transaction_id} 缺少耗電量資料，無法計費`);
          continue;
        }
        
        // 根據槍的tariff關聯獲取費率方案
        let tariff = await getTariffForGun(transaction.cpid, transaction.cpsn);
        if (!tariff) {
          // 如果沒有找到槍的tariff關聯，使用預設費率方案
          tariff = await getDefaultTariff();
        }
        
        if (!tariff) {
          logger.warn(`交易 ${transaction.transaction_id} 找不到可用的費率方案，跳過計費`);
          continue;
        }
        
        // 計算帳單
        await calculateBill(transaction, tariff);
        processedCount++;
      } catch (error) {
        logger.error(`處理交易 ${transaction.transaction_id} 帳單失敗:`, error);
        // 繼續處理下一筆
      }
    }
    
    logger.info(`成功處理 ${processedCount} 筆交易的帳單`);
    return processedCount;
  } catch (error) {
    logger.error(`批次處理未計費交易失敗:`, error);
    throw error;
  }
}

/**
 * 判斷是否為尖峰時段
 * @param {number} hour 小時 (0-23)
 * @param {string} peakStart 尖峰開始時間 (HH:MM)
 * @param {string} peakEnd 尖峰結束時間 (HH:MM)
 * @returns {boolean} 是否為尖峰時段
 */
function isPeakHour(hour, peakStart, peakEnd) {
  if (!peakStart || !peakEnd) return false;
  
  const startHour = parseInt(peakStart.split(':')[0]);
  const endHour = parseInt(peakEnd.split(':')[0]);
  
  if (startHour <= endHour) {
    // 同一天內的時段 (例如 09:00-17:00)
    return hour >= startHour && hour < endHour;
  } else {
    // 跨日的時段 (例如 22:00-06:00)
    return hour >= startHour || hour < endHour;
  }
}

/**
 * 判斷是否為週末
 * @param {Date} date 日期
 * @returns {boolean} 是否為週末
 */
function isWeekendDay(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0=週日, 6=週六
}

module.exports = {
  getTariffs,
  getDefaultTariff,
  getTariffForGun,
  calculateBill,
  generateBillForTransaction,
  processUnbilledTransactions
};
