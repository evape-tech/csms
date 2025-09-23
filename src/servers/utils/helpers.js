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

module.exports = {
  generateUniqueId
};
