// 充電樁事件管理工具

/**
 * 觸發充電樁更新事件，通知相關組件重新載入資料
 * @param {string} eventType - 事件類型: 'updated', 'deleted', 'added'
 * @param {Object} data - 相關資料
 */
export function triggerChargingStationEvent(eventType, data = {}) {
  if (typeof window === 'undefined') return;
  
  const eventName = `chargingStation${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`;
  const event = new CustomEvent(eventName, { detail: data });
  
  console.log(`Triggering ${eventName} event:`, data);
  window.dispatchEvent(event);
  
  // 也觸發通用的充電樁事件
  const genericEvent = new CustomEvent('chargingStationChanged', { 
    detail: { type: eventType, ...data } 
  });
  window.dispatchEvent(genericEvent);
}

/**
 * 直接呼叫重新載入充電狀態的方法（如果可用）
 */
export function refreshChargingStatus() {
  if (typeof window !== 'undefined' && window.refreshChargingStatus) {
    console.log('Calling window.refreshChargingStatus...');
    window.refreshChargingStatus();
  } else {
    console.log('window.refreshChargingStatus not available, triggering event instead');
    triggerChargingStationEvent('updated');
  }
}

/**
 * 在充電樁刪除後呼叫
 */
export function onChargingStationDeleted(gunId) {
  triggerChargingStationEvent('deleted', { gunId });
  refreshChargingStatus();
}

/**
 * 在充電樁更新後呼叫
 */
export function onChargingStationUpdated(gunId, updateData) {
  triggerChargingStationEvent('updated', { gunId, updateData });
  refreshChargingStatus();
}

/**
 * 在充電樁新增後呼叫
 */
export function onChargingStationAdded(gunData) {
  triggerChargingStationEvent('added', { gunData });
  refreshChargingStatus();
}
