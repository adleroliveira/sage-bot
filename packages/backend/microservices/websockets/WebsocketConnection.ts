import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

export class WebsocketConnection {
  private connectionId: string;
  constructor(
    private websocket: WebSocket,
    private handleMessage: (
      data: WebSocket.Data,
      websocket: WebsocketConnection
    ) => void,
    private handleClose: (connectionId: string) => void
  ) {
    this.connectionId = uuidv4();
    websocket.on("message", this.handleWebsocketMessages.bind(this));
    websocket.on("close", this.handleCloseConnection.bind(this));
  }

  public send(message: string) {
    this.websocket.send(message);
  }

  private handleCloseConnection() {
    this.handleClose(this.connectionId);
  }

  private handleWebsocketMessages(message: WebSocket.Data) {
    this.handleMessage(message, this);
  }

  public getConnectionId() {
    return this.connectionId;
  }
}
