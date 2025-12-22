/**
 * 費率計算器 (Rate Calculator)
 * 從 billingRepository.js 抽出的純函式，便於單元測試和重用
 * 
 * 包含各種費率類型的計算邏輯：
 * - FIXED_RATE: 固定費率
 * - TIME_OF_USE: 時段電價（尖峰/離峰/假日）
 * - PROGRESSIVE: 累進電價
 * - MEMBERSHIP / SPECIAL_PROMOTION: 會員/促銷折扣
 */

/**
 * 安全解析浮點數
 * @param {any} value - 需要解析的值
 * @param {number} defaultValue - 預設值
 * @returns {number} 解析後的數值
 */
function safeParseFloat(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 計算固定費率 (FIXED_RATE)
 * 公式: 總金額 = 充電量 × 固定單價
 * 
 * @param {number} energyConsumed - 充電量 (kWh)
 * @param {object} tariff - 費率方案 {base_price}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateFixedRate(energyConsumed, tariff) {
  const appliedPrice = safeParseFloat(tariff.base_price);
  const energyFee = energyConsumed * appliedPrice;
  
  return {
    energyFee,
    appliedPrice,
    discountAmount: 0,
    billingDetails: {
      rateType: 'FIXED_RATE',
      unitPrice: appliedPrice,
      calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
    }
  };
}

/**
 * 計算時段電價 (TIME_OF_USE)
 * 支援尖峰/離峰/假日電價
 * 
 * 優先順序:
 * 1. 假日電價（週六、週日且有設定 weekend_price）
 * 2. 尖峰電價（平日且在尖峰時段內）
 * 3. 離峰電價（其他時間）
 * 
 * @param {number} energyConsumed - 充電量 (kWh)
 * @param {Date} chargingStartTime - 充電開始時間
 * @param {object} tariff - 費率方案 {base_price, peak_hours_start, peak_hours_end, peak_hours_price, off_peak_price, weekend_price}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateTimeOfUse(energyConsumed, chargingStartTime, tariff) {
  const chargingStartHour = chargingStartTime.getHours();
  const chargingDay = chargingStartTime.getDay(); // 0=Sunday, 6=Saturday
  
  const peakStartHour = parseInt(tariff.peak_hours_start?.split(':')[0] || '9');
  const peakEndHour = parseInt(tariff.peak_hours_end?.split(':')[0] || '18');
  
  let appliedPrice = safeParseFloat(tariff.base_price);
  let rateType = 'BASE';
  let timeFrame = '基礎';
  
  // 檢查是否為假日（週六或週日）
  const isWeekend = (chargingDay === 0 || chargingDay === 6);
  
  // 優先使用假日電價（如果有設定且為假日）
  if (isWeekend && tariff.weekend_price) {
    appliedPrice = safeParseFloat(tariff.weekend_price);
    rateType = 'WEEKEND';
    timeFrame = '假日';
  } else {
    // 平日：檢查是否在尖峰時段
    const isPeakTime = (chargingStartHour >= peakStartHour && chargingStartHour < peakEndHour);
    
    if (isPeakTime) {
      appliedPrice = safeParseFloat(tariff.peak_hours_price, appliedPrice);
      rateType = 'PEAK_HOURS';
      timeFrame = '尖峰時段';
    } else {
      appliedPrice = safeParseFloat(tariff.off_peak_price, appliedPrice);
      rateType = 'OFF_PEAK_HOURS';
      timeFrame = '離峰時段';
    }
  }
  
  const energyFee = energyConsumed * appliedPrice;
  
  return {
    energyFee,
    appliedPrice,
    discountAmount: 0,
    billingDetails: {
      rateType,
      timeFrame,
      unitPrice: appliedPrice,
      calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
    }
  };
}

/**
 * 計算累進電價 (PROGRESSIVE)
 * 根據用電量分階段計費
 * 
 * 階段劃分:
 * - 階段1: 0 ~ tier1_max_kwh (使用 tier1_price)
 * - 階段2: tier1_max_kwh ~ tier2_max_kwh (使用 tier2_price)
 * - 階段3: > tier2_max_kwh (使用 tier3_price)
 * 
 * @param {number} energyConsumed - 充電量 (kWh)
 * @param {object} tariff - 費率方案 {base_price, tier1_max_kwh, tier1_price, tier2_max_kwh, tier2_price, tier3_price}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateProgressive(energyConsumed, tariff) {
  const basePrice = safeParseFloat(tariff.base_price);
  const tier1Max = safeParseFloat(tariff.tier1_max_kwh);
  const tier2Max = safeParseFloat(tariff.tier2_max_kwh);
  const tier1Price = safeParseFloat(tariff.tier1_price, basePrice);
  const tier2Price = safeParseFloat(tariff.tier2_price, basePrice);
  const tier3Price = safeParseFloat(tariff.tier3_price, basePrice);
  
  let remainingEnergy = energyConsumed;
  let tier1Energy = 0;
  let tier2Energy = 0;
  let tier3Energy = 0;
  let tier1Cost = 0;
  let tier2Cost = 0;
  let tier3Cost = 0;
  
  // 階段1: 0 ~ tier1_max_kwh
  if (remainingEnergy > 0 && tier1Max > 0) {
    tier1Energy = Math.min(remainingEnergy, tier1Max);
    tier1Cost = tier1Energy * tier1Price;
    remainingEnergy -= tier1Energy;
  }
  
  // 階段2: tier1_max_kwh ~ tier2_max_kwh
  if (remainingEnergy > 0 && tier2Max > tier1Max) {
    tier2Energy = Math.min(remainingEnergy, tier2Max - tier1Max);
    tier2Cost = tier2Energy * tier2Price;
    remainingEnergy -= tier2Energy;
  }
  
  // 階段3: > tier2_max_kwh
  if (remainingEnergy > 0) {
    tier3Energy = remainingEnergy;
    tier3Cost = tier3Energy * tier3Price;
  }
  
  const energyFee = tier1Cost + tier2Cost + tier3Cost;
  const appliedPrice = energyFee / energyConsumed; // 平均單價
  
  return {
    energyFee,
    appliedPrice,
    discountAmount: 0,
    billingDetails: {
      rateType: 'PROGRESSIVE',
      tier1Energy,
      tier2Energy,
      tier3Energy,
      tier1Cost,
      tier2Cost,
      tier3Cost,
      tier1Price,
      tier2Price,
      tier3Price,
      calculation: `階梯1: ${tier1Energy.toFixed(2)} kWh × ${tier1Price} = ${tier1Cost.toFixed(2)}\n` +
                   `階梯2: ${tier2Energy.toFixed(2)} kWh × ${tier2Price} = ${tier2Cost.toFixed(2)}\n` +
                   `階梯3: ${tier3Energy.toFixed(2)} kWh × ${tier3Price} = ${tier3Cost.toFixed(2)}\n` +
                   `總計: ${energyFee.toFixed(2)}`
    }
  };
}

/**
 * 計算會員/促銷折扣 (MEMBERSHIP / SPECIAL_PROMOTION)
 * 
 * 計算步驟:
 * 1. 計算原價 = 充電量 × 基礎單價
 * 2. 計算折扣金額 = 原價 × 折扣百分比 / 100
 * 3. 計算實付金額 = 原價 - 折扣金額
 * 
 * @param {number} energyConsumed - 充電量 (kWh)
 * @param {object} tariff - 費率方案 {base_price, discount_percentage, tariff_type}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateDiscount(energyConsumed, tariff) {
  const appliedPrice = safeParseFloat(tariff.base_price);
  const originalAmount = energyConsumed * appliedPrice;
  const discountPercentage = safeParseFloat(tariff.discount_percentage);
  
  let discountAmount = 0;
  let energyFee = originalAmount;
  
  // 應用折扣
  if (discountPercentage > 0) {
    discountAmount = (originalAmount * discountPercentage) / 100;
    energyFee = originalAmount - discountAmount;
  }
  
  return {
    energyFee,
    appliedPrice,
    discountAmount,
    billingDetails: {
      rateType: tariff.tariff_type,
      unitPrice: appliedPrice,
      discountPercentage,
      originalAmount,
      discountAmount,
      calculation: `${energyConsumed} kWh × ${appliedPrice} = ${originalAmount.toFixed(2)}\n` +
                   `折扣: ${discountPercentage}% = ${discountAmount.toFixed(2)}\n` +
                   `折后金额: ${energyFee.toFixed(2)}`
    }
  };
}

/**
 * 計算自訂費率或其他類型 (CUSTOM / 其他)
 * 
 * @param {number} energyConsumed - 充電量 (kWh)
 * @param {object} tariff - 費率方案 {base_price}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateCustomRate(energyConsumed, tariff) {
  const appliedPrice = safeParseFloat(tariff.base_price);
  const energyFee = energyConsumed * appliedPrice;
  
  return {
    energyFee,
    appliedPrice,
    discountAmount: 0,
    billingDetails: {
      rateType: 'CUSTOM',
      unitPrice: appliedPrice,
      calculation: `${energyConsumed} kWh × ${appliedPrice} = ${energyFee.toFixed(2)}`
    }
  };
}

/**
 * 根據費率類型計算費用（主入口函數）
 * 
 * @param {object} transaction - 交易記錄 {energy_consumed, start_time}
 * @param {object} tariff - 費率方案 {tariff_type, ...}
 * @returns {object} {energyFee, appliedPrice, discountAmount, billingDetails}
 */
function calculateRateByType(transaction, tariff) {
  const energyConsumed = safeParseFloat(transaction.energy_consumed);
  
  if (energyConsumed <= 0) {
    throw new Error('充電量必須大於 0');
  }
  
  switch (tariff.tariff_type) {
    case 'FIXED_RATE':
      return calculateFixedRate(energyConsumed, tariff);
      
    case 'TIME_OF_USE':
      return calculateTimeOfUse(energyConsumed, transaction.start_time, tariff);
      
    case 'PROGRESSIVE':
      return calculateProgressive(energyConsumed, tariff);
      
    case 'SPECIAL_PROMOTION':
    case 'MEMBERSHIP':
      return calculateDiscount(energyConsumed, tariff);
      
    default:
      return calculateCustomRate(energyConsumed, tariff);
  }
}

// 匯出所有函數
export { calculateFixedRate, calculateTimeOfUse, calculateProgressive, calculateDiscount, calculateCustomRate, calculateRateByType, safeParseFloat };
