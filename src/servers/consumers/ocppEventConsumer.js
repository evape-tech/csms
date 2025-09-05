/**
 * OCPP事件消费者
 * 处理OCPP相关事件
 */
const mqService = require('../services/mqService');
const { EXCHANGES } = require('../mqServer');
const chargeEventService = require('../services/chargeEventService');

// 队列名称
const QUEUES = {
  CHARGING_STARTED: 'ocpp.charging.started',
  CHARGING_STOPPED: 'ocpp.charging.stopped',
  STATUS_CHANGED: 'ocpp.status.changed',
  METER_VALUES: 'ocpp.meter.values',
  CONNECTION_STATE: 'ocpp.connection.state'
};

/**
 * 设置充电开始事件消费者
 */
async function setupChargingStartedConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.CHARGING_STARTED,
      EXCHANGES.OCPP_EVENTS,
      chargeEventService.EVENT_TYPES.CHARGING_STARTED
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.CHARGING_STARTED,
      chargeEventService.handleChargingStarted,
      { prefetch: 10 }
    );
    
    console.log(`✅ 充电开始事件消费者设置成功`);
  } catch (error) {
    console.error(`❌ 充电开始事件消费者设置失败:`, error.message);
  }
}

/**
 * 设置充电结束事件消费者
 */
async function setupChargingStoppedConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.CHARGING_STOPPED,
      EXCHANGES.OCPP_EVENTS,
      chargeEventService.EVENT_TYPES.CHARGING_STOPPED
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.CHARGING_STOPPED,
      chargeEventService.handleChargingStopped,
      { prefetch: 10 }
    );
    
    console.log(`✅ 充电结束事件消费者设置成功`);
  } catch (error) {
    console.error(`❌ 充电结束事件消费者设置失败:`, error.message);
  }
}

/**
 * 设置状态变更事件消费者
 */
async function setupStatusChangedConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.STATUS_CHANGED,
      EXCHANGES.OCPP_EVENTS,
      chargeEventService.EVENT_TYPES.STATUS_CHANGED
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.STATUS_CHANGED,
      async (data) => {
        console.log(`📊 处理状态变更事件:`, data);
        // 在这里添加状态变更的业务逻辑
        return true;
      },
      { prefetch: 10 }
    );
    
    console.log(`✅ 状态变更事件消费者设置成功`);
  } catch (error) {
    console.error(`❌ 状态变更事件消费者设置失败:`, error.message);
  }
}

/**
 * 设置计量值事件消费者
 */
async function setupMeterValuesConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.METER_VALUES,
      EXCHANGES.OCPP_EVENTS,
      chargeEventService.EVENT_TYPES.METER_VALUES
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.METER_VALUES,
      async (data) => {
        console.log(`📈 处理计量值事件:`, data);
        // 在这里添加计量值处理的业务逻辑
        return true;
      },
      { prefetch: 20 } // 计量值可能比较多，增加预取数量
    );
    
    console.log(`✅ 计量值事件消费者设置成功`);
  } catch (error) {
    console.error(`❌ 计量值事件消费者设置失败:`, error.message);
  }
}

/**
 * 设置连接状态事件消费者
 */
async function setupConnectionStateConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.CONNECTION_STATE,
      EXCHANGES.OCPP_EVENTS,
      chargeEventService.EVENT_TYPES.CONNECTION_STATE
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.CONNECTION_STATE,
      async (data) => {
        console.log(`🔌 处理连接状态事件:`, data);
        // 在这里添加连接状态处理的业务逻辑
        return true;
      },
      { prefetch: 5 }
    );
    
    console.log(`✅ 连接状态事件消费者设置成功`);
  } catch (error) {
    console.error(`❌ 连接状态事件消费者设置失败:`, error.message);
  }
}

/**
 * 初始化所有OCPP事件消费者
 */
async function initConsumers() {
  console.log(`🚀 初始化OCPP事件消费者...`);
  
  try {
    await Promise.all([
      setupChargingStartedConsumer(),
      setupChargingStoppedConsumer(),
      setupStatusChangedConsumer(),
      setupMeterValuesConsumer(),
      setupConnectionStateConsumer()
    ]);
    
    console.log(`✅ 所有OCPP事件消费者初始化完成`);
    return true;
  } catch (error) {
    console.error(`❌ OCPP事件消费者初始化失败:`, error.message);
    return false;
  }
}

module.exports = {
  initConsumers,
  QUEUES
};
