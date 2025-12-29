/**
 * 辅助工具函数
 */

import crypto from 'crypto';

/**
 * 生成唯一ID
 * 用于OCPP消息ID
 * @returns {string} 唯一ID
 */
export function generateUniqueId() {
  return crypto.randomBytes(8).toString('hex');
}
