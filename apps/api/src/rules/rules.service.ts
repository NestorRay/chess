import { Injectable, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import type { Board, FairyStockfish } from "ffish";
import type { ResultReason, Side } from "@xiangqi/contracts";

type RuntimeModule = FairyStockfish & {
  onRuntimeInitialized?: () => void;
  calledRun?: boolean;
};

export interface AppliedMove {
  fen: string;
  notation: string;
  turn: Side;
  inCheck: boolean;
  legalMoves: string[];
  winner: Side | null;
  resultReason: ResultReason | null;
}

@Injectable()
export class RulesService implements OnModuleInit {
  private engine!: RuntimeModule;

  async onModuleInit() {
    this.engine = await this.loadEngine();
  }

  getInitialFen() {
    return this.withBoard(undefined, (board) => board.fen());
  }

  getLegalMoves(fen: string) {
    return this.withBoard(fen, (board) => this.splitMoves(board.legalMoves()).map((move) => this.toClientMove(move)));
  }

  isCheck(fen: string) {
    return this.withBoard(fen, (board) => board.isCheck());
  }

  applyMove(fen: string, move: string): AppliedMove {
    return this.withBoard(fen, (board) => {
      const engineMove = this.toEngineMove(move);
      const legalMoves = this.splitMoves(board.legalMoves());
      if (!legalMoves.includes(engineMove)) throw new Error("该落子不符合中国象棋规则");

      const notation = board.sanMove(engineMove, this.engine.Notation.XIANGQI_WXF);
      if (!board.push(engineMove)) throw new Error("规则引擎拒绝了该落子");

      const nextMoves = this.splitMoves(board.legalMoves()).map((nextMove) => this.toClientMove(nextMove));
      const inCheck = board.isCheck();
      const result = board.isGameOver(true) ? board.result(true) : "*";
      let winner: Side | null = null;
      if (result === "1-0") winner = "RED";
      if (result === "0-1") winner = "BLACK";

      let resultReason: ResultReason | null = null;
      if (result !== "*") {
        if (nextMoves.length === 0) resultReason = inCheck ? "CHECKMATE" : "STALEMATE";
        else resultReason = "RULE_DRAW";
      }

      return {
        fen: board.fen(),
        notation,
        turn: board.turn() ? "RED" : "BLACK",
        inCheck,
        legalMoves: nextMoves,
        winner,
        resultReason,
      };
    });
  }

  private withBoard<T>(fen: string | undefined, action: (board: Board) => T): T {
    if (!this.engine?.Board) throw new ServiceUnavailableException("象棋规则引擎尚未就绪");
    const board = fen ? new this.engine.Board("xiangqi", fen) : new this.engine.Board("xiangqi");
    try {
      return action(board);
    } finally {
      board.delete();
    }
  }

  private splitMoves(value: string) {
    return value.trim() ? value.trim().split(/\s+/) : [];
  }

  private toEngineMove(move: string) {
    const match = /^([a-i])([0-9])([a-i])([0-9])$/.exec(move);
    if (!match) throw new Error("棋步坐标格式不正确");
    return `${match[1]}${Number(match[2]) + 1}${match[3]}${Number(match[4]) + 1}`;
  }

  private toClientMove(move: string) {
    const match = /^([a-i])(10|[1-9])([a-i])(10|[1-9])$/.exec(move);
    if (!match) throw new Error(`规则引擎返回了无法识别的棋步: ${move}`);
    return `${match[1]}${Number(match[2]) - 1}${match[3]}${Number(match[4]) - 1}`;
  }

  private loadEngine(): Promise<RuntimeModule> {
    return new Promise((resolve, reject) => {
      const scope = globalThis as unknown as { fetch: typeof fetch | undefined };
      const savedFetch = scope.fetch;
      let engine: RuntimeModule;
      try {
        // ffish 0.7.x mistakes Node's global fetch for a browser fetch and cannot load local WASM.
        scope.fetch = undefined;
        engine = require("ffish") as RuntimeModule;
      } finally {
        scope.fetch = savedFetch;
      }

      if (engine.Board) {
        resolve(engine);
        return;
      }

      const timer = setTimeout(() => reject(new Error("ffish WASM 初始化超时")), 10_000);
      engine.onRuntimeInitialized = () => {
        clearTimeout(timer);
        resolve(engine);
      };
    });
  }
}
