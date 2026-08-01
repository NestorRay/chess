import { beforeAll, describe, expect, it } from "vitest";
import { RulesService } from "./rules.service";

describe("RulesService", () => {
  const rules = new RulesService();

  beforeAll(async () => {
    await rules.onModuleInit();
  });

  it("returns the standard Xiangqi position and client coordinates", () => {
    const fen = rules.getInitialFen();
    expect(fen).toContain("rnbakabnr");
    expect(rules.getLegalMoves(fen)).toContain("a0a1");
    expect(rules.getLegalMoves(fen)).toContain("b0a2");
    expect(rules.getLegalMoves(fen)).toContain("b2b9");
  });

  it("applies a legal move and changes the side to move", () => {
    const result = rules.applyMove(rules.getInitialFen(), "a0a1");
    expect(result.turn).toBe("BLACK");
    expect(result.fen.split(" ")[1]).toBe("b");
    expect(result.resultReason).toBeNull();
  });

  it("rejects blocked and out-of-rule moves", () => {
    const fen = rules.getInitialFen();
    expect(() => rules.applyMove(fen, "a0b0")).toThrow("不符合中国象棋规则");
    expect(() => rules.applyMove(fen, "e0e3")).toThrow("不符合中国象棋规则");
  });

  it("enforces piece-specific blocking and palace rules", () => {
    const openingMoves = rules.getLegalMoves(rules.getInitialFen());
    expect(openingMoves).toContain("b0a2");
    expect(openingMoves).toContain("c0e2");
    expect(openingMoves).toContain("d0e1");
    expect(openingMoves).toContain("b2b9");
    expect(openingMoves).not.toContain("b2b8");
    expect(openingMoves).not.toContain("a3b3");

    const blockedHorse = "4k4/9/9/9/4p4/9/9/9/1P7/1N2K4 w - - 0 1";
    expect(rules.getLegalMoves(blockedHorse)).not.toContain("b0a2");
    expect(rules.getLegalMoves(blockedHorse)).not.toContain("b0c2");
  });

  it("does not allow exposing the two generals on one file", () => {
    const fen = "4k4/9/9/9/9/4R4/9/9/9/4K4 w - - 0 1";
    const rookMoves = rules.getLegalMoves(fen).filter((move) => move.startsWith("e4"));
    expect(rookMoves.length).toBeGreaterThan(0);
    expect(rookMoves.every((move) => move[2] === "e")).toBe(true);
  });

  it("detects a checkmate terminal position", () => {
    const beforeMate = "4k4/3P1P3/4R4/9/9/9/9/9/9/4K4 w - - 0 1";
    const result = rules.applyMove(beforeMate, "e7e8");
    expect(result.resultReason).toBe("CHECKMATE");
    expect(result.winner).toBe("RED");
  });
});
