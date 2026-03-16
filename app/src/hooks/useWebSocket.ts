import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WebSocketService,
  createContainersWebSocket,
  createEventsWebSocket,
  createStatsWebSocket,
  createLogsWebSocket,
  DockerEvent,
  LogEntry,
} from '../services/websocket';
import type { ContainerSummary, ContainerStats } from '../types';

// Hook for real-time container list updates
export function useContainersWebSocket(enabled = true) {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [lastEvent, setLastEvent] = useState<DockerEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ws = createContainersWebSocket(
      (containersList) => {
        setContainers(containersList);
        setConnected(true);
      },
      (event) => {
        setLastEvent(event);
      },
      () => {
        setError('WebSocket connection error');
        setConnected(false);
      }
    );

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [enabled]);

  const refresh = useCallback(() => {
    wsRef.current?.send({ action: 'refresh' });
  }, []);

  return { containers, lastEvent, connected, error, refresh };
}

// Hook for Docker events stream
export function useDockerEvents(enabled = true) {
  const [events, setEvents] = useState<DockerEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ws = createEventsWebSocket(
      (event) => {
        setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events
        setConnected(true);
      },
      () => {
        setConnected(false);
      }
    );

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [enabled]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connected, clearEvents };
}

// Hook for real-time container stats
export function useContainerStats(containerId: string | null, enabled = true) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!enabled || !containerId) {
      setStats(null);
      return;
    }

    const ws = createStatsWebSocket(
      containerId,
      (containerStats) => {
        console.log('[useContainerStats] Received stats:', containerStats);
        setStats(containerStats);
        setConnected(true);
        setError(null);
      },
      () => {
        setError('Stats WebSocket error');
        setConnected(false);
      }
    );

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setStats(null);
    };
  }, [containerId, enabled]);

  return { stats, connected, error };
}

// Hook for real-time container logs
export function useContainerLogs(
  containerId: string | null,
  options?: { tail?: string; enabled?: boolean }
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled || !containerId) {
      setLogs([]);
      return;
    }

    const ws = createLogsWebSocket(
      containerId,
      (log) => {
        setLogs((prev) => [...prev, log].slice(-1000)); // Keep last 1000 lines
        setConnected(true);
      },
      { tail: options?.tail },
      () => {
        setError('Logs WebSocket error');
        setConnected(false);
      }
    );

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [containerId, enabled, options?.tail]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, connected, error, clearLogs };
}
