import { z } from "zod";

export const sideSchema = z.enum(["RED", "BLACK"]);
export const gameStatusSchema = z.enum(["WAITING", "ACTIVE", "FINISHED"]);
export const resultReasonSchema = z.enum([
  "CHECKMATE",
  "STALEMATE",
  "RESIGNATION",
  "DRAW_AGREEMENT",
  "RULE_DRAW",
]);

export const coordinateSchema = z
  .string()
  .regex(/^[a-i][0-9]$/, "棋盘坐标必须为 a0 到 i9");

export const createGameSchema = z.object({
  nickname: z.string().trim().min(1).max(24),
});

export const joinGameSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/),
  nickname: z.string().trim().min(1).max(24),
});

export const submitMoveSchema = z.object({
  gameId: z.string().min(1),
  from: coordinateSchema,
  to: coordinateSchema,
  expectedPly: z.number().int().nonnegative(),
});

export const resignGameSchema = z.object({ gameId: z.string().min(1) });
export const drawResponseSchema = z.object({
  gameId: z.string().min(1),
  accept: z.boolean(),
});

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_\u4e00-\u9fff]+$/),
  password: z.string().min(8).max(128),
});

export const loginSchema = registerSchema;

export type Side = z.infer<typeof sideSchema>;
export type GameStatus = z.infer<typeof gameStatusSchema>;
export type ResultReason = z.infer<typeof resultReasonSchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type SubmitMoveInput = z.infer<typeof submitMoveSchema>;
export type ResignGameInput = z.infer<typeof resignGameSchema>;
export type DrawResponseInput = z.infer<typeof drawResponseSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicPlayer {
  side: Side;
  nickname: string;
  connected: boolean;
}

export interface GameState {
  id: string;
  code: string;
  status: GameStatus;
  fen: string;
  turn: Side;
  ply: number;
  playerSide: Side;
  legalMoves: string[];
  inCheck: boolean;
  players: PublicPlayer[];
  winner: Side | null;
  resultReason: ResultReason | null;
  drawOfferedBy: Side | null;
  replayToken: string | null;
}

export interface ReplayMove {
  ply: number;
  from: string;
  to: string;
  notation: string;
  fenAfter: string;
  createdAt: string;
}

export interface ReplayData {
  id: string;
  code: string;
  initialFen: string;
  status: GameStatus;
  winner: Side | null;
  resultReason: ResultReason | null;
  startedAt: string | null;
  endedAt: string | null;
  players: PublicPlayer[];
  moves: ReplayMove[];
}

export interface GameSummary {
  id: string;
  code: string;
  status: GameStatus;
  opponent: string | null;
  nickname: string;
  playerSide: Side;
  winner: Side | null;
  resultReason: ResultReason | null;
  updatedAt: string;
  replayToken: string | null;
}

export interface GameHistory {
  items: GameSummary[];
  hasMore: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface ServerToClientEvents {
  "game:state": (state: GameState) => void;
  "move:accepted": (state: GameState) => void;
  "move:rejected": (payload: { reason: string }) => void;
  "game:ended": (state: GameState) => void;
  "game:error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "game:join": (input: JoinGameInput) => void;
  "move:submit": (input: SubmitMoveInput) => void;
  "game:resign": (input: ResignGameInput) => void;
  "game:draw-offer": (input: ResignGameInput) => void;
  "game:draw-respond": (input: DrawResponseInput) => void;
}
