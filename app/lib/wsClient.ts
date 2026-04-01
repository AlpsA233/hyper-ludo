/**
 * Browser-side WebSocket client singleton.
 * Manages connection, request-response, and broadcast event distribution.
 */

type MessageHandler = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void }
  >();
  private listeners = new Map<string, Set<MessageHandler>>();
  private userId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionReady: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;
  private connectionReject: ((err: Error) => void) | null = null;

  private getUrl(): string {
    if (typeof window === "undefined") return "ws://localhost:3001";
    // Allow override via env var (e.g. NEXT_PUBLIC_WS_URL=ws://localhost:3001)
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (envUrl) return envUrl;
    return `ws://${window.location.hostname}:3001`;
  }

  connect(userId: string) {
    // Don't reconnect if already open or connecting with the same userId
    if (this.userId === userId && this.ws) {
      const state = this.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return;
      }
    }
    this.userId = userId;
    this.doConnect();
  }

  private doConnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    }

    // Reject any previous waiters so they don't hang forever
    if (this.connectionReject) {
      this.connectionReject(new Error("Reconnecting"));
    }

    this.connectionReady = new Promise((resolve, reject) => {
      this.connectionResolve = resolve;
      this.connectionReject = reject;
    });

    const url = this.getUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[WS] connected to", url);
      if (this.userId && this.ws) {
        this.ws.send(
          JSON.stringify({ action: "identify", userId: this.userId }),
        );
      }
      this.connectionResolve?.();
      this.connectionReject = null;
    };

    this.ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.data);
      } else if (msg.type) {
        const handlers = this.listeners.get(msg.type);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.data);
          }
        }
      }
    };

    this.ws.onclose = () => {
      console.log("[WS] disconnected, reconnecting in 2s...");
      this.reconnectTimer = setTimeout(() => this.doConnect(), 2000);
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  /** Wait until the socket is OPEN, with a timeout */
  private async waitForConnection(timeoutMs = 5000): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const raceTimeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("WebSocket connection timeout")),
        timeoutMs,
      ),
    );

    // Retry: if connectionReady rejects (reconnecting), wait for the next one
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (this.connectionReady) {
          await Promise.race([this.connectionReady, raceTimeout]);
        }
        if (this.ws?.readyState === WebSocket.OPEN) return;
      } catch {
        // connectionReady was rejected (reconnect) or timed out
        if (this.ws?.readyState === WebSocket.OPEN) return;
        // Wait a tick for the new connectionReady promise to be created
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
  }

  async send(action: string, data: any = {}): Promise<any> {
    await this.waitForConnection();

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });
      this.ws!.send(
        JSON.stringify({ id, action, userId: this.userId, ...data }),
      );

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${action}`));
        }
      }, 10000);
    });
  }

  on(event: string, handler: MessageHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.pending.clear();
    this.connectionReady = null;
    this.connectionReject = null;
  }
}

export const wsClient = new WsClient();
