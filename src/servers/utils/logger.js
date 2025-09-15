/**
 * 日志工具模块
 * 统一处理应用程序日志
 */

// 日志级别
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// 获取当前日志级别
function getLogLevel() {
  const level = process.env.LOG_LEVEL || 'INFO';
  return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
}

// 获取调用堆栈信息
function getCallerInfo() {
  const error = new Error();
  const stack = error.stack.split('\n');
  // 找到调用logger的位置 (第4行通常是调用者)
  const callerLine = stack[3] || '';
  const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
  
  if (match) {
    return {
      method: match[1],
      file: match[2].split('/').pop(),
      line: match[3]
    };
  } else {
    return {
      method: 'unknown',
      file: 'unknown',
      line: '0'
    };
  }
}

/**
 * 格式化日志
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 * @param {Object} details 其他详细信息
 * @returns {string} 格式化的日志字符串
 */
function formatLog(level, message, details = null) {
  const now = new Date();
  const timestamp = now.toISOString();
  
  let logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (details) {
    if (typeof details === 'string') {
      logMessage += ` - ${details}`;
    } else if (details instanceof Error) {
      logMessage += ` - ${details.message}\n${details.stack}`;
    } else {
      try {
        logMessage += ` - ${JSON.stringify(details)}`;
      } catch {
        logMessage += ` - [Non-serializable Object]`;
      }
    }
  }
  
  return logMessage;
}

/**
 * 错误日志
 * @param {string} message 日志消息
 * @param {Object} details 其他详细信息
 */
function error(message, details = null) {
  if (getLogLevel() >= LOG_LEVELS.ERROR) {
    console.error(formatLog('ERROR', message, details));
  }
}

/**
 * 警告日志
 * @param {string} message 日志消息
 * @param {Object} details 其他详细信息
 */
function warn(message, details = null) {
  if (getLogLevel() >= LOG_LEVELS.WARN) {
    console.warn(formatLog('WARN', message, details));
  }
}

/**
 * 信息日志
 * @param {string} message 日志消息
 * @param {Object} details 其他详细信息
 */
function info(message, details = null) {
  if (getLogLevel() >= LOG_LEVELS.INFO) {
    console.log(formatLog('INFO', message, details));
  }
}

/**
 * 调试日志
 * @param {string} message 日志消息
 * @param {Object} details 其他详细信息
 */
function debug(message, details = null) {
  if (getLogLevel() >= LOG_LEVELS.DEBUG) {
    console.log(formatLog('DEBUG', message, details));
  }
}

// 对外导出接口
module.exports = {
  error,
  warn,
  info,
  debug
};
