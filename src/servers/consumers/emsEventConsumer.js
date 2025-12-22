/**
 * EMS事件消费者
 * 处理能源管理系统相关事件
 */
import * as mqService from '../services/mqService.js';
import { EXCHANGES } from '../mqServer.js';
import * as emsService from '../services/emsService.js';

// 队列名称
const QUEUES = {
  ALLOCATION_REQUEST: 'ems.allocation.request',
  ALLOCATION_RESULT: 'ems.allocation.result',
  PROFILE_UPDATE: 'ems.profile.update',
  GLOBAL_REALLOCATION: 'ems.global.reallocation'
};

/**
 * 设置功率分配请求消费者
 */
async function setupAllocationRequestConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.ALLOCATION_REQUEST,
      EXCHANGES.EMS_EVENTS,
      emsService.EVENT_TYPES.ALLOCATION_REQUEST
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.ALLOCATION_REQUEST,
      emsService.handleAllocationRequest,
      { prefetch: 1 } // 功率分配计算可能比较重，限制并发
    );
    
    console.log(`✅ 功率分配请求消费者设置成功`);
  } catch (error) {
    console.error(`❌ 功率分配请求消费者设置失败:`, error.message);
  }
}

/**
 * 设置功率分配结果消费者
 */
async function setupAllocationResultConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.ALLOCATION_RESULT,
      EXCHANGES.EMS_EVENTS,
      emsService.EVENT_TYPES.ALLOCATION_RESULT
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.ALLOCATION_RESULT,
      async (data) => {
        console.log(`📊 处理功率分配结果:`, data);
        // 在这里添加功率分配结果处理的业务逻辑
        
        // 如果分配成功，可以触发功率配置更新
        if (data.result && !data.error) {
          // 这里可以触发相应的充电桩配置更新
          console.log(`⚡ 分配结果处理完成，开始更新充电桩配置...`);
        }
        
        return true;
      },
      { prefetch: 5 }
    );
    
    console.log(`✅ 功率分配结果消费者设置成功`);
  } catch (error) {
    console.error(`❌ 功率分配结果消费者设置失败:`, error.message);
  }
}

/**
 * 设置功率配置更新消费者
 */
async function setupProfileUpdateConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.PROFILE_UPDATE,
      EXCHANGES.EMS_EVENTS,
      emsService.EVENT_TYPES.PROFILE_UPDATE
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.PROFILE_UPDATE,
      async (data) => {
        console.log(`🔌 处理功率配置更新:`, data);
        // 在这里添加功率配置更新处理的业务逻辑
        return true;
      },
      { prefetch: 10 }
    );
    
    console.log(`✅ 功率配置更新消费者设置成功`);
  } catch (error) {
    console.error(`❌ 功率配置更新消费者设置失败:`, error.message);
  }
}

/**
 * 设置全站重新分配消费者
 */
async function setupGlobalReallocationConsumer() {
  try {
    // 创建队列
    await mqService.bindQueue(
      QUEUES.GLOBAL_REALLOCATION,
      EXCHANGES.EMS_EVENTS,
      emsService.EVENT_TYPES.GLOBAL_REALLOCATION
    );
    
    // 创建消费者
    await mqService.setupConsumer(
      QUEUES.GLOBAL_REALLOCATION,
      emsService.handleGlobalReallocation,
      { prefetch: 1 } // 全站重分配是重量级操作，限制并发
    );
    
    console.log(`✅ 全站重新分配消费者设置成功`);
  } catch (error) {
    console.error(`❌ 全站重新分配消费者设置失败:`, error.message);
  }
}

/**
 * 初始化所有EMS事件消费者
 */
async function initConsumers() {
  console.log(`🚀 初始化EMS事件消费者...`);
  
  try {
    await Promise.all([
      setupAllocationRequestConsumer(),
      setupAllocationResultConsumer(),
      setupProfileUpdateConsumer(),
      setupGlobalReallocationConsumer()
    ]);
    
    console.log(`✅ 所有EMS事件消费者初始化完成`);
    return true;
  } catch (error) {
    console.error(`❌ EMS事件消费者初始化失败:`, error.message);
    return false;
  }
}

export { initConsumers, QUEUES };
