import {
  IServerConfig,
  MicroserviceFramework,
  Loggable,
  IRequest,
  IResponse,
  RequestHandler,
} from "microservice-framework";
import { ChatbotBackend } from "../chatbot/ChatbotService";
import { WebsocketConnection } from "./WebsocketConnection";
import WebSocket from "ws";
import http from "http";

export interface WebsocketServiceInput {}
export interface WebsocketServiceOutput {}
export interface WebSocketResponse<WebsocketServiceOutput>
  extends IResponse<WebsocketServiceOutput> {}
export interface WebsocketServiceConfig extends IServerConfig {
  wsport: number;
  authToken: string;
}

export class WebsocketService extends MicroserviceFramework<
  WebsocketServiceInput,
  WebsocketServiceOutput
> {
  private wsconnections: Map<string, WebsocketConnection> = new Map();
  private wsport: number;
  private wss!: WebSocket.Server;
  private authToken: string;
  private httpServer!: http.Server;

  constructor(backend: ChatbotBackend, config: WebsocketServiceConfig) {
    super(backend, config);
    this.wsport = config.wsport || 8080;
    this.authToken = config.authToken;
    this.initializeWebsocketService();
  }

  private async initializeWebsocketService() {
    try {
      this.httpServer = http.createServer((req, res) => {
        if (req.url === "/health") {
          res.writeHead(200);
          res.end("OK");
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      this.wss = new WebSocket.Server({ port: this.wsport, host: "0.0.0.0" });
      this.httpServer.listen(8081, "0.0.0.0", () => {
        this.info(`WebSocket server started on port ${this.wsport}`);
      });
      this.wss.on("connection", this.handleWsConnect.bind(this));
    } catch (error) {
      throw new Error("Error while trying to create Websocket Server");
    }
  }

  @RequestHandler<IRequest<{ text: string; sessionId: string }>>("RELAY")
  private async relayToConnection(request: IRequest<any>) {
    let { text, sessionId } = request.body;
    this.info("Relaying Request", request);
    request.body = text;
    const connectionId = sessionId;
    if (connectionId && this.wsconnections.has(connectionId)) {
      await this.sendToConnection(connectionId, JSON.stringify(request));
      this.info("Relayed Request to connection", request);
    }
    return { success: true };
  }

  @RequestHandler<IRequest<any>>("heartbeat")
  private async handleHeartbeat(request: IRequest<any>) {
    return this.createSuccessResponse(request, "Heartbeat received");
  }

  @RequestHandler<IRequest<{ token: string }>>("authenticate")
  private async handleAuthentication(request: IRequest<{ token: string }>) {
    if (request.body.token !== this.authToken)
      throw new Loggable.LoggableError("Invalid token");
    this.info("Connection Authenticated", { token: request.body.token });
    return this.createSuccessResponse(
      request,
      JSON.stringify({ success: true })
    );
  }

  @Loggable.handleErrors
  async handleWsConnect(ws: WebSocket) {
    const connection = new WebsocketConnection(
      ws,
      this.handleWsMessage.bind(this),
      this.handleWsClose.bind(this)
    );
    this.wsconnections.set(connection.getConnectionId(), connection);
  }

  @Loggable.handleErrors
  async handleWsClose(connectionId: string) {
    this.wsconnections.delete(connectionId);
  }

  @Loggable.handleErrors
  async handleWsMessage(
    data: WebSocket.Data,
    websocket: WebsocketConnection
  ): Promise<void> {
    try {
      if (Buffer.isBuffer(data)) data = data.toString("utf-8");
      if (typeof data === "string") {
        const message: IRequest<any> = JSON.parse(data);
        if (isRequest(message)) {
          await this.handleRelayRequest(message, websocket);
        } else {
          console.warn("Received non-request message", data);
        }
      }
    } catch (error: any) {
      console.error("Error handling WebSocket message", error);
      const response = this.createErrorResponse(data, error);
      websocket.send(JSON.stringify(response));
    }
  }

  @Loggable.handleErrors
  private async handleRelayRequest(
    message: IRequest<any>,
    websocket: WebsocketConnection
  ) {
    const destination = message.header.recipientAddress;
    if (!destination) {
      this.warn("No destination provided");
      const errorResponse = this.createErrorResponse(
        message,
        `No valid destination provided`
      );
      websocket.send(JSON.stringify(errorResponse));
      return;
    }

    try {
      const response = await this.makeRequest({
        requestType: message.header.requestType || "RELAY::MESSAGE",
        to: destination,
        body: message.body,
        replyTo: this.address,
        headers: {
          ...message.header,
          requesterAddress: websocket.getConnectionId(),
        },
        handleStatusUpdate: async (request, status) => {
          const update = this.createSuccessResponse(request, status.status);
          this.sendToConnection(
            websocket.getConnectionId(),
            JSON.stringify(update)
          );
        },
      });
      websocket.send(JSON.stringify(response));
    } catch (error) {
      const errorResponse = this.createErrorResponse(message, error);
      websocket.send(JSON.stringify(errorResponse));
    }
  }

  private createErrorResponse(
    originalMessage: any,
    error: any
  ): WebSocketResponse<WebsocketServiceOutput> {
    return MicroserviceFramework.createResponse(
      originalMessage,
      this.address,
      { message: error.message || error },
      false
    );
  }

  private createSuccessResponse(
    originalMessage: IRequest<any>,
    message: string
  ): WebSocketResponse<WebsocketServiceOutput> {
    return MicroserviceFramework.createResponse(
      originalMessage,
      this.address,
      { message },
      true
    );
  }

  async sendToConnection(connectionId: string, message: string) {
    const connection = this.wsconnections.get(connectionId);
    if (connection) {
      connection.send(message);
    } else {
      this.wsconnections.delete(connectionId);
    }
  }
}

function isRequest(data: any): data is IRequest<any> {
  return data && typeof data === "object" && "header" in data && "body" in data;
}
