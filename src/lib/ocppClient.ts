/**
 * OCPP Core API Client
 * 主项目通过此客户端与ocpp-core微服务通信
 */

const OCPP_API_URL = process.env.NEXT_PUBLIC_OCPP_API_URL || 'http://localhost:3001';

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

// ============= Charger API =============

export interface ChargerStatus {
  id: string;
  status: 'Available' | 'Charging' | 'Unavailable' | 'Faulted';
  connectorId: number;
  currentPower: number;
  maxPower: number;
  online: boolean;
  lastUpdate: string;
}

/**
 * 获取所有充电器状态
 */
export async function getChargers(): Promise<ChargerStatus[]> {
  const response = await fetch(`${OCPP_API_URL}/api/chargers`);
  const result: ApiResponse<ChargerStatus[]> = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to fetch chargers');
  }
  
  return result.data || [];
}

/**
 * 获取单个充电器状态
 */
export async function getChargerStatus(chargerId: string): Promise<ChargerStatus> {
  const response = await fetch(`${OCPP_API_URL}/api/chargers/${chargerId}/status`);
  const result: ApiResponse<ChargerStatus> = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to fetch charger status');
  }
  
  return result.data!;
}

/**
 * 启动充电
 */
export async function startCharging(chargerId: string, data: {
  connectorId: number;
  idTag: string;
}): Promise<{ transactionId: string }> {
  const response = await fetch(`${OCPP_API_URL}/api/chargers/${chargerId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result: ApiResponse = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to start charging');
  }
  
  return result.data;
}

/**
 * 停止充电
 */
export async function stopCharging(chargerId: string, transactionId: string): Promise<void> {
  const response = await fetch(`${OCPP_API_URL}/api/chargers/${chargerId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId }),
  });
  
  const result: ApiResponse = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to stop charging');
  }
}

// ============= EMS API =============

export type EmsMode = 'static' | 'dynamic';

export interface EmsStatus {
  mode: EmsMode;
  totalPowerLimit: number;
  activePowerUsage: number;
  chargerCount: number;
  lastUpdate: string;
}

export interface EmsAllocationRequest {
  chargers: string[];
  mode?: EmsMode;
  totalPowerLimit?: number;
}

export interface EmsAllocationResult {
  chargerId: string;
  allocatedPower: number;
  previousPower: number;
}

/**
 * 获取EMS状态
 */
export async function getEmsStatus(): Promise<EmsStatus> {
  const response = await fetch(`${OCPP_API_URL}/api/ems/status`);
  const result: ApiResponse<EmsStatus> = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to fetch EMS status');
  }
  
  return result.data!;
}

/**
 * 执行EMS功率分配
 */
export async function allocateEmsPower(request: EmsAllocationRequest): Promise<EmsAllocationResult[]> {
  const response = await fetch(`${OCPP_API_URL}/api/ems/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  const result: ApiResponse<EmsAllocationResult[]> = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to allocate power');
  }
  
  return result.data || [];
}

/**
 * 更新EMS配置
 */
export async function updateEmsConfig(config: {
  mode?: EmsMode;
  totalPowerLimit?: number;
}): Promise<void> {
  const response = await fetch(`${OCPP_API_URL}/api/ems/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  
  const result: ApiResponse = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to update EMS config');
  }
}

// ============= Transaction API =============

export interface Transaction {
  transactionId: string;
  chargerId: string;
  connectorId: number;
  idTag: string;
  startTime: string;
  endTime?: string;
  meterStart: number;
  meterStop?: number;
  energyConsumed?: number;
  status: 'active' | 'completed' | 'failed';
}

/**
 * 获取所有交易记录
 */
export async function getTransactions(filters?: {
  chargerId?: string;
  status?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters?.chargerId) params.append('chargerId', filters.chargerId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  
  const response = await fetch(`${OCPP_API_URL}/api/transactions?${params}`);
  const result: ApiResponse<Transaction[]> = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.error || 'Failed to fetch transactions');
  }
  
  return result.data || [];
}

// ============= WebSocket Connection =============

/**
 * 创建WebSocket连接以接收实时更新
 */
export function createWebSocketConnection(
  onMessage: (event: any) => void,
  onError?: (error: Event) => void
): WebSocket {
  const wsUrl = OCPP_API_URL.replace('http', 'ws');
  const ws = new WebSocket(`${wsUrl}/ws/chargers`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    onError?.(error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };
  
  return ws;
}
