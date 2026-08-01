import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@xiangqi/contracts";

export const gameSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
});
