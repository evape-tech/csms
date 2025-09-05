/**
 * 辅助工具函数
 */

const crypto = require('crypto');

/**
 * 生成唯一ID
 * 用于OCPP消息ID
 * @returns {string} 唯一ID
 */
function generateUniqueId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * 延迟执行
 * @param {number} ms 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化日期时间
 * @param {Date|string} date 日期对象或字符串
 * @param {string} format 格式化模式
 * @returns {string} 格式化后的字符串
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  
  const pad = (num) => num < 10 ? `0${num}` : `${num}`;
  
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 解析时间间隔（将字符串转换为秒数）
 * @param {string} durationStr 格式为 "HH:mm:ss" 的时间间隔字符串
 * @returns {number} 总秒数
 */
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  const parts = durationStr.split(':').map(Number);
  
  if (parts.length !== 3) return 0;
  
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * 格式化时间间隔（将秒数转换为字符串）
 * @param {number} seconds 总秒数
 * @returns {string} 格式为 "HH:mm:ss" 的时间间隔字符串
 */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '0:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 对象深拷贝
 * @param {Object} obj 需要拷贝的对象
 * @returns {Object} 拷贝后的对象
 */
function deepCopy(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj);
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepCopy(item));
  }
  
  if (obj instanceof Object) {
    const copy = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = deepCopy(obj[key]);
      }
    }
    return copy;
  }
  
  return obj;
}

/**
 * 生成固定长度的随机数字字符串
 * @param {number} length 字符串长度
 * @returns {string} 随机数字字符串
 */
function generateRandomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

/**
 * 检查对象是否为空
 * @param {Object} obj 要检查的对象
 * @returns {boolean} 是否为空
 */
function isEmptyObject(obj) {
  return obj === null || obj === undefined || 
    (typeof obj === 'object' && Object.keys(obj).length === 0);
}

/**
 * 尝试解析JSON字符串，失败时返回默认值
 * @param {string} jsonString JSON字符串
 * @param {any} defaultValue 解析失败时的默认值
 * @returns {any} 解析结果或默认值
 */
function tryParseJSON(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * 尝试转换为数字，失败时返回默认值
 * @param {string|any} value 要转换的值
 * @param {number} defaultValue 转换失败时的默认值
 * @returns {number} 转换结果或默认值
 */
function tryParseNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 安全访问嵌套对象属性
 * @param {Object} obj 对象
 * @param {string} path 属性路径，如 "a.b.c"
 * @param {any} defaultValue 默认值
 * @returns {any} 属性值或默认值
 */
function safeGet(obj, path, defaultValue = undefined) {
  if (!obj || !path) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === undefined || result === null) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === undefined ? defaultValue : result;
}

module.exports = {
  generateUniqueId,
  delay,
  formatDate,
  parseDuration,
  formatDuration,
  deepCopy,
  generateRandomDigits,
  isEmptyObject,
  tryParseJSON,
  tryParseNumber,
  safeGet
};
