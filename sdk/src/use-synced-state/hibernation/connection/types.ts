export type SyncedStateStatus = "connected" | "disconnected" | "reconnecting";
export type StatusChangeCallback = (status: SyncedStateStatus) => void;

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

export type WebSocketFactory = (url: string) => WebSocket;

export type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

export type Connection = {
  ws: WebSocket;
  nextId: number;
  pending: Map<string, PendingRequest>;
  isOpen: boolean;
  messageHandlers: Map<string, Set<(value: unknown) => void>>;
  deadConnectionTimer: ReturnType<typeof setTimeout> | null;
  webSocketFactory: WebSocketFactory;
};
