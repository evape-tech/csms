/**
 * API 配置管理
 * 統一管理API路徑和版本
 */

import path from 'path';
import dotenv from 'dotenv';

// 根據 NODE_ENV 決定使用哪個 .env 文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// API配置
const API = {
  // API版本
  VERSION: process.env.API_VERSION || 'v1',
  // 基礎API路徑
  BASE_PATH: process.env.API_BASE_PATH || '/api',
  // OCPP API基礎路徑
  OCPP_BASE_PATH: process.env.OCPP_API_BASE_PATH || '/ocpp/api'
};

/**
 * 構建標準REST API路徑
 * @param {string} path - API端點路徑，以 / 開頭
 * @returns {string} 完整的API路徑
 */
function buildApiPath(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API.BASE_PATH}/${API.VERSION}${cleanPath}`;
}

/**
 * 構建OCPP專用API路徑
 * @param {string} path - API端點路徑，以 / 開頭
 * @returns {string} 完整的OCPP API路徑
 */
function buildOcppApiPath(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API.OCPP_BASE_PATH}/${API.VERSION}${cleanPath}`;
}

/**
 * 構建系統級API路徑（不帶版本號）
 * @param {string} path - API端點路徑，以 / 開頭
 * @returns {string} 系統級API路徑
 */
function buildSystemApiPath(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath;
}

// API路徑常量
const API_PATHS = {
  // 系統級路徑（不帶版本）
  HEALTH: buildSystemApiPath('/health'),
  
  // 標準REST API路徑（帶版本）
  CHARGEPOINTS_ONLINE: buildApiPath('/chargepoints/online'),
  CHARGEPOINT_REMOTE_START: buildApiPath('/chargepoints/:cpsn/remotestart'),
  CHARGEPOINT_REMOTE_STOP: buildApiPath('/chargepoints/:cpsn/remotestop'),
  CHARGEPOINT_RESET: buildApiPath('/chargepoints/:cpsn/reset'),
  
  // Billing相關API路徑
  BILLING_RECORDS: buildApiPath('/billing/records'),
  BILLING_STATISTICS: buildApiPath('/billing/statistics'),
  BILLING_GENERATE: buildApiPath('/billing/generate'),
  
  // OCPP專用API路徑（帶版本）
  OCPP_TRIGGER_PROFILE_UPDATE: buildOcppApiPath('/trigger_profile_update'),
  OCPP_TRIGGER_METER_REALLOCATION: buildOcppApiPath('/trigger_meter_reallocation'),
  OCPP_TRIGGER_STATION_REALLOCATION: buildOcppApiPath('/trigger_station_reallocation')
};

export { API, API_PATHS, buildApiPath, buildOcppApiPath, buildSystemApiPath };
