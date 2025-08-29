/**
 * 使用充電樁事件的示例代碼
 * 
 * 在刪除、更新或新增充電樁的組件中，您可以這樣使用：
 */

import { onChargingStationDeleted, onChargingStationUpdated, onChargingStationAdded } from '../lib/events/chargingStationEvents';

// 示例：刪除充電樁後的處理
async function handleDeleteGun(gunId) {
  try {
    const response = await fetch(`/api/guns/${gunId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('充電樁刪除成功:', result);
      
      // 觸發事件通知充電狀態更新
      onChargingStationDeleted(gunId);
      
      // 或者直接呼叫重新載入
      // refreshChargingStatus();
      
    } else {
      console.error('刪除失敗:', await response.text());
    }
  } catch (error) {
    console.error('刪除充電樁時發生錯誤:', error);
  }
}

// 示例：更新充電樁後的處理
async function handleUpdateGun(gunId, updateData) {
  try {
    const response = await fetch(`/api/guns/${gunId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('充電樁更新成功:', result);
      
      // 觸發事件通知充電狀態更新
      onChargingStationUpdated(gunId, updateData);
      
    } else {
      console.error('更新失敗:', await response.text());
    }
  } catch (error) {
    console.error('更新充電樁時發生錯誤:', error);
  }
}

// 示例：新增充電樁後的處理
async function handleCreateGun(gunData) {
  try {
    const response = await fetch('/api/guns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gunData),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('充電樁新增成功:', result);
      
      // 觸發事件通知充電狀態更新
      onChargingStationAdded(result);
      
    } else {
      console.error('新增失敗:', await response.text());
    }
  } catch (error) {
    console.error('新增充電樁時發生錯誤:', error);
  }
}

export { handleDeleteGun, handleUpdateGun, handleCreateGun };
