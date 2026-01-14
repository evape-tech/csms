/**
 * 使用示例：在Next.js页面中调用OCPP Core API
 */

import { getChargers, startCharging, getEmsStatus } from '@/lib/ocppClient';

// ============= Example 1: Server Component =============

export default async function ChargersPage() {
  // 服务端获取数据
  const chargers = await getChargers();
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">充电器列表</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {chargers.map(charger => (
          <ChargerCard key={charger.id} charger={charger} />
        ))}
      </div>
    </div>
  );
}

// ============= Example 2: Client Component with Actions =============

'use client';

import { useState } from 'react';
import { startCharging, stopCharging } from '@/lib/ocppClient';

export function ChargerControls({ chargerId }: { chargerId: string }) {
  const [loading, setLoading] = useState(false);
  
  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await startCharging(chargerId, {
        connectorId: 1,
        idTag: 'USER001'
      });
      alert(`充电已启动，交易ID: ${result.transactionId}`);
    } catch (error) {
      alert(`启动失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStop = async (transactionId: string) => {
    setLoading(true);
    try {
      await stopCharging(chargerId, transactionId);
      alert('充电已停止');
    } catch (error) {
      alert(`停止失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={handleStart} disabled={loading}>
        启动充电
      </button>
      <button onClick={() => handleStop('TXN_123')} disabled={loading}>
        停止充电
      </button>
    </div>
  );
}

// ============= Example 3: EMS Management =============

'use client';

import { useEffect, useState } from 'react';
import { getEmsStatus, allocateEmsPower } from '@/lib/ocppClient';
import type { EmsStatus } from '@/lib/ocppClient';

export function EmsControl() {
  const [status, setStatus] = useState<EmsStatus | null>(null);
  
  useEffect(() => {
    loadStatus();
  }, []);
  
  const loadStatus = async () => {
    const data = await getEmsStatus();
    setStatus(data);
  };
  
  const handleAllocate = async () => {
    await allocateEmsPower({
      chargers: ['CP001', 'CP002', 'CP003'],
      mode: 'dynamic',
      totalPowerLimit: 100000
    });
    await loadStatus();
  };
  
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl mb-2">EMS 状态</h2>
      {status && (
        <>
          <p>模式: {status.mode}</p>
          <p>总功率限制: {status.totalPowerLimit}W</p>
          <p>当前使用: {status.activePowerUsage}W</p>
          <p>充电器数量: {status.chargerCount}</p>
        </>
      )}
      <button onClick={handleAllocate}>执行功率分配</button>
    </div>
  );
}

// ============= Example 4: Real-time Updates =============

'use client';

import { useEffect, useState } from 'react';
import { createWebSocketConnection } from '@/lib/ocppClient';

export function RealtimeChargerStatus() {
  const [updates, setUpdates] = useState<any[]>([]);
  
  useEffect(() => {
    const ws = createWebSocketConnection(
      (event) => {
        setUpdates(prev => [event, ...prev].slice(0, 10));
      },
      (error) => {
        console.error('WebSocket error:', error);
      }
    );
    
    return () => {
      ws.close();
    };
  }, []);
  
  return (
    <div>
      <h2>实时更新</h2>
      <div className="space-y-2">
        {updates.map((update, i) => (
          <div key={i} className="p-2 bg-gray-100 rounded">
            <span className="font-bold">{update.type}</span>: {update.chargerId}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= Example 5: Server Actions =============

'use server';

import { startCharging, stopCharging } from '@/lib/ocppClient';
import { revalidatePath } from 'next/cache';

export async function startChargingAction(chargerId: string, idTag: string) {
  try {
    const result = await startCharging(chargerId, {
      connectorId: 1,
      idTag
    });
    
    revalidatePath('/chargers');
    
    return { success: true, transactionId: result.transactionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function stopChargingAction(chargerId: string, transactionId: string) {
  try {
    await stopCharging(chargerId, transactionId);
    
    revalidatePath('/chargers');
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
