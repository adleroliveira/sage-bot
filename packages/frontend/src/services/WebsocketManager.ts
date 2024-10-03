import {
  CommunicationsManager,
  ICommunicationsManagerConfig,
} from "communications-manager";

class WebSocketManagerSingleton {
  private static instance: WebSocketManagerSingleton;
  private commsManager: CommunicationsManager | null = null;
  private config: ICommunicationsManagerConfig;

  private constructor() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // const wsUrl = `${protocol}//${host}/ws/`;
    const wsUrl = `ws://localhost:8080/ws/`;

    this.config = {
      url: wsUrl,
      secure: window.location.protocol === "https:",
      authToken: "",
      maxReconnectAttempts: 5,
      reconnectInterval: 5000,
      requestTimeout: 120000,
    };
  }

  public static getInstance(): WebSocketManagerSingleton {
    if (!WebSocketManagerSingleton.instance) {
      WebSocketManagerSingleton.instance = new WebSocketManagerSingleton();
    }
    return WebSocketManagerSingleton.instance;
  }

  public getCommsManager(authToken?: string): CommunicationsManager {
    if (!this.commsManager) {
      this.commsManager = new CommunicationsManager({
        ...this.config,
        authToken,
      });
    }
    return this.commsManager;
  }

  public close() {
    if (this.commsManager) {
      this.commsManager.close();
      this.commsManager = null;
    }
  }
}

export const WebSocketManager = WebSocketManagerSingleton.getInstance();
