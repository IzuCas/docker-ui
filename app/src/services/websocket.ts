import type { ContainerSummary, ContainerStats } from '../types';

// Get WebSocket URL based on environment
function getWsUrl(): string {
  // Check if running in Electron
  if (window.electronAPI?.isElectron) {
    const apiUrl = window.electronAPI.getApiUrl();
    // Convert http:// to ws://
    return apiUrl.replace(/^http/, 'ws');
  }
  
  // In web mode (Vite dev server), connect directly to API server
  // The API runs on port 8001
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // Check if we have a configured API URL
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = new URL(import.meta.env.VITE_API_URL);
    return `${protocol}//${apiUrl.host}`;
  }
  
  // Default: API is on localhost:8001
  return `${protocol}//localhost:8001`;
}

const WS_URL = getWsUrl();
console.log('[WebSocket] Base URL:', WS_URL);

export interface DockerEvent {
  type: string;
  action: string;
  actor: {
    id: string;
    attributes: Record<string, string>;
  };
  time: number;
  timeNano: number;
}

export interface LogEntry {
  timestamp: string;
  stream: string;
  message: string;
}

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
}

type MessageHandler<T> = (data: T) => void;
type ErrorHandler = (error: Event) => void;
type CloseHandler = (event: CloseEvent) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private onMessage: MessageHandler<WSMessage>;
  private onError?: ErrorHandler;
  private onClose?: CloseHandler;
  private shouldReconnect = true;

  constructor(
    endpoint: string,
    onMessage: MessageHandler<WSMessage>,
    options?: {
      onError?: ErrorHandler;
      onClose?: CloseHandler;
      autoReconnect?: boolean;
    }
  ) {
    this.url = `${WS_URL}${endpoint}`;
    this.onMessage = onMessage;
    this.onError = options?.onError;
    this.onClose = options?.onClose;
    this.shouldReconnect = options?.autoReconnect ?? true;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[WebSocket] Connecting to:', this.url);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        console.log('[WebSocket] Message received:', data.type, data.payload);
        this.onMessage(data);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.onError?.(error);
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Closed:', event.code, event.reason);
      this.onClose?.(event);
      
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[WebSocket] Reconnecting (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Helper functions for specific WebSocket endpoints

export function createContainersWebSocket(
  onContainersList: (containers: ContainerSummary[]) => void,
  onEvent?: (event: DockerEvent) => void,
  onError?: (error: Event) => void
): WebSocketService {
  const ws = new WebSocketService(
    '/ws/containers',
    (message) => {
      if (message.type === 'containers_list') {
        onContainersList(message.payload as ContainerSummary[]);
      } else if (message.type === 'container_event' && onEvent) {
        onEvent(message.payload as DockerEvent);
      }
    },
    { onError, autoReconnect: true }
  );
  return ws;
}

export function createEventsWebSocket(
  onEvent: (event: DockerEvent) => void,
  onError?: (error: Event) => void
): WebSocketService {
  const ws = new WebSocketService(
    '/ws/events',
    (message) => {
      if (message.type === 'container_event') {
        onEvent(message.payload as DockerEvent);
      }
    },
    { onError, autoReconnect: true }
  );
  return ws;
}

export function createStatsWebSocket(
  containerId: string,
  onStats: (stats: ContainerStats) => void,
  onError?: (error: Event) => void
): WebSocketService {
  const ws = new WebSocketService(
    `/ws/containers/stats?id=${containerId}`,
    (message) => {
      if (message.type === 'container_stats') {
        onStats(message.payload as ContainerStats);
      }
    },
    { onError, autoReconnect: true }
  );
  return ws;
}

export function createLogsWebSocket(
  containerId: string,
  onLog: (log: LogEntry) => void,
  options?: { tail?: string },
  onError?: (error: Event) => void
): WebSocketService {
  const tail = options?.tail || '100';
  const ws = new WebSocketService(
    `/ws/containers/logs?id=${containerId}&tail=${tail}`,
    (message) => {
      if (message.type === 'container_log') {
        onLog(message.payload as LogEntry);
      }
    },
    { onError, autoReconnect: false } // Don't reconnect for logs to avoid duplicate entries
  );
  return ws;
}
