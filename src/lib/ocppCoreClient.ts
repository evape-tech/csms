const DEFAULT_BASE_URL = (process.env.OCPP_CORE_URL || "http://localhost:8089").replace(/\/$/, "");
const DEFAULT_WS_URL = process.env.OCPP_CORE_WS_URL || "ws://localhost:8089/ocpp";
const API_TOKEN = process.env.OCPP_CORE_API_TOKEN || "";

interface RequestOptions extends RequestInit {
  path: string;
}

async function request<T = unknown>({ path, ...init }: RequestOptions): Promise<T> {
  const url = `${DEFAULT_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (API_TOKEN) {
    headers["X-API-Token"] = API_TOKEN;
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: any = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text when not JSON
  }

  if (!response.ok) {
    const error = new Error(
      `OCPP-Core request failed (${response.status}): ${response.statusText}`,
    ) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export async function remoteStart(params: {
  cpsn: string;
  connectorId: number;
  idTag: string;
  chargingProfile?: unknown;
}) {
  return request({
    path: "/api/ocpp/remote-start",
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function remoteStop(params: { cpsn: string; transactionId: number }) {
  return request({
    path: "/api/ocpp/remote-stop",
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function triggerRebalance(params: {
  stationId?: string | number;
  meterId?: string | number;
  triggerEvent?: string;
  eventDetails?: Record<string, unknown>;
}) {
  const payload = {
    stationId: params.stationId ?? "all",
    meterId: params.meterId ?? "all",
    triggerEvent: params.triggerEvent || "csms_update",
    eventDetails: params.eventDetails,
  };

  return request({
    path: "/api/ems/rebalance",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function configurePower(params: {
  cpids: string[];
  immediate?: boolean;
  eventType?: string;
  eventDetails?: Record<string, unknown>;
}) {
  return request({
    path: "/api/ems/configure-power",
    method: "POST",
    body: JSON.stringify({
      cpids: params.cpids,
      immediate: params.immediate ?? false,
      eventType: params.eventType || "csms_update",
      eventDetails: params.eventDetails,
    }),
  });
}

export function getOcppCoreBaseUrl() {
  return DEFAULT_BASE_URL;
}

export function getOcppCoreWsUrl() {
  return DEFAULT_WS_URL;
}
