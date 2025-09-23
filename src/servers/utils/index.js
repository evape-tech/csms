/**
 * 工具模块导出
 */

const logger = require('./logger');
const { generateUniqueId } = require('./helpers');

module.exports = {
  logger,
  generateUniqueId
};
