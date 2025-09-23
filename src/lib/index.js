/**
 * Lib 模块导出
 * 为了兼容性，这个文件使用 CommonJS 格式，因为要被服务器端代码使用
 */

const { calculateEmsAllocation } = require('./emsAllocator.js');

module.exports = {
  calculateEmsAllocation
};
