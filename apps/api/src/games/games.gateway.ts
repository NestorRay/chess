import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { ClientToServerEvents, ServerToClientEvents } from "@xiangqi/contracts";
import {
  drawResponseSchema,
  joinGameSchema,
  resignGameSchema,
  submitMoveSchema,
} from "@xiangqi/contracts";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import type { RequestIdentity } from "../auth/auth.types";
import { GamesService } from "./games.service";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, {
  identity?: RequestIdentity;
  gameIds?: Set<string>;
}>;

@WebSocketGateway({
  cors: {
    origin: (process.env.APP_ORIGIN ?? "http://localhost:5173").split(","),
    credentials: true,
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(
    private readonly auth: AuthService,
    private readonly games: GamesService,
  ) {}

  async handleConnection(socket: GameSocket) {
    const identity = await this.auth.resolveSocketCookie(socket.handshake.headers.cookie);
    if (!identity) {
      socket.emit("game:error", { message: "会话已失效，请刷新页面" });
      socket.disconnect(true);
      return;
    }
    socket.data.identity = identity;
    socket.data.gameIds = new Set();
  }

  async handleDisconnect(socket: GameSocket) {
    for (const gameId of socket.data.gameIds ?? []) {
      await this.broadcastState(gameId, "game:state");
    }
  }

  @SubscribeMessage("game:join")
  async join(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    await this.run(socket, async (identity) => {
      const input = joinGameSchema.parse(body);
      const game = await this.games.join(identity, input);
      await socket.join(game.id);
      socket.data.gameIds?.add(game.id);
      await this.broadcastState(game.id, "game:state");
    });
  }

  @SubscribeMessage("move:submit")
  async move(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    await this.run(socket, async (identity) => {
      const input = submitMoveSchema.parse(body);
      const result = await this.games.move(identity, input);
      await this.broadcastState(result.gameId, result.ended ? "game:ended" : "move:accepted");
    }, true);
  }

  @SubscribeMessage("game:resign")
  async resign(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    await this.run(socket, async (identity) => {
      const input = resignGameSchema.parse(body);
      const result = await this.games.resign(identity, input);
      await this.broadcastState(result.gameId, "game:ended");
    });
  }

  @SubscribeMessage("game:draw-offer")
  async offerDraw(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    await this.run(socket, async (identity) => {
      const input = resignGameSchema.parse(body);
      const result = await this.games.offerDraw(identity, input);
      await this.broadcastState(result.gameId, "game:state");
    });
  }

  @SubscribeMessage("game:draw-respond")
  async respondDraw(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    await this.run(socket, async (identity) => {
      const input = drawResponseSchema.parse(body);
      const result = await this.games.respondDraw(identity, input);
      await this.broadcastState(result.gameId, result.ended ? "game:ended" : "game:state");
    });
  }

  async connectedIdentityKeysFor(gameId: string): Promise<Set<string>> {
    const sockets = (await this.server.in(gameId).fetchSockets()) as unknown as GameSocket[];
    const connectedIds = new Set<string>();
    for (const socket of sockets) {
      const identity = socket.data.identity;
      if (!identity) continue;
      connectedIds.add(`g:${identity.guestId}`);
      if (identity.userId) connectedIds.add(`u:${identity.userId}`);
    }
    return connectedIds;
  }

  private async broadcastState(gameId: string, event: "game:state" | "move:accepted" | "game:ended") {
    const sockets = (await this.server.in(gameId).fetchSockets()) as unknown as GameSocket[];
    const connectedIds = new Set<string>();
    for (const socket of sockets) {
      const identity = socket.data.identity;
      if (!identity) continue;
      connectedIds.add(`g:${identity.guestId}`);
      if (identity.userId) connectedIds.add(`u:${identity.userId}`);
    }
    await Promise.all(sockets.map(async (socket) => {
      const identity = socket.data.identity;
      if (!identity) return;
      const state = await this.games.state(gameId, identity, connectedIds);
      if (event === "game:state") socket.emit("game:state", state);
      if (event === "move:accepted") socket.emit("move:accepted", state);
      if (event === "game:ended") socket.emit("game:ended", state);
    }));
  }

  private async run(
    socket: GameSocket,
    action: (identity: RequestIdentity) => Promise<void>,
    moveError = false,
  ) {
    const identity = socket.data.identity;
    if (!identity) {
      socket.emit("game:error", { message: "未建立有效会话" });
      return;
    }
    try {
      await action(identity);
    } catch (error) {
      const message = this.errorMessage(error);
      if (moveError) socket.emit("move:rejected", { reason: message });
      else socket.emit("game:error", { message });
    }
  }

  private errorMessage(error: unknown) {
    if (error && typeof error === "object" && "getResponse" in error) {
      const response = (error as { getResponse: () => unknown }).getResponse();
      if (typeof response === "string") return response;
      if (response && typeof response === "object" && "message" in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message[0] ?? "请求失败" : message;
      }
    }
    if (error && typeof error === "object" && "issues" in error) return "提交的数据格式不正确";
    return error instanceof Error ? error.message : "请求失败";
  }
}
