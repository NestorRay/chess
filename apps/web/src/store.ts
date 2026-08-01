import { create } from "zustand";
import type { GameState } from "@xiangqi/contracts";

interface GameStore {
  game: GameState | null;
  connection: "connecting" | "connected" | "disconnected";
  message: string | null;
  setGame: (game: GameState | null) => void;
  setConnection: (connection: GameStore["connection"]) => void;
  setMessage: (message: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  connection: "disconnected",
  message: null,
  setGame: (game) => set({ game }),
  setConnection: (connection) => set({ connection }),
  setMessage: (message) => set({ message }),
  reset: () => set({ game: null, message: null, connection: "disconnected" }),
}));
