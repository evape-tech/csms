/**
 * 消息消费者模块导出
 */

const ocppEventConsumer = require('./ocppEventConsumer');
const emsEventConsumer = require('./emsEventConsumer');

module.exports = {
  ocppEventConsumer,
  emsEventConsumer
};
