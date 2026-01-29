/**
 * 系统状态服务
 * 管理和报告系统各组件状态
 */

// 系统组件状态
const systemStatus = {
  // 服务状态
  ocppServer: {
    status: 'starting',
    startTime: null,
    uptime: 0,
    connections: 0
  },
  // 事件统计
  events: {
    received: 0,
    sent: 0,
    errors: 0
  }
};

// 更新服务启动状态
function updateServerStatus(status) {
  if (status === 'running' && systemStatus.ocppServer.status !== 'running') {
    systemStatus.ocppServer.startTime = Date.now();
  }
  
  systemStatus.ocppServer.status = status;
  
  // 计算运行时间
  if (systemStatus.ocppServer.startTime) {
    systemStatus.ocppServer.uptime = Math.floor((Date.now() - systemStatus.ocppServer.startTime) / 1000);
  }
}

// 更新连接数量
function updateConnectionCount(count) {
  systemStatus.ocppServer.connections = count;
}

// 增加事件统计
function incrementEventCounter(type) {
  if (type in systemStatus.events) {
    systemStatus.events[type]++;
  }
}

// 获取完整系统状态
function getSystemStatus() {
  // 更新运行时间
  if (systemStatus.ocppServer.startTime) {
    systemStatus.ocppServer.uptime = Math.floor((Date.now() - systemStatus.ocppServer.startTime) / 1000);
  }
  
  return {
    ...systemStatus,
    timestamp: new Date().toISOString()
  };
}

export {
  updateServerStatus,
  updateConnectionCount,
  incrementEventCounter,
  getSystemStatus
};
