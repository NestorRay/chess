import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GamesService } from "./games.service";
import type { RequestIdentity } from "../auth/auth.types";

const identity: RequestIdentity = { sessionId: "s-b", guestId: "g-b", userId: null, username: null };

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
}

function createService() {
  const prisma = {
    game: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    gameParticipant: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    move: { create: vi.fn() },
    guestIdentity: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  const rules = { applyMove: vi.fn(), getInitialFen: vi.fn(), getLegalMoves: vi.fn(), isCheck: vi.fn() };
  const service = new GamesService(prisma as never, rules as never);
  return { service, prisma };
}

describe("GamesService", () => {
  let service: GamesService;
  let prisma: ReturnType<typeof createService>["prisma"];

  beforeEach(() => {
    ({ service, prisma } = createService());
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  });

  it("join converts a P2002 side race into a ConflictException instead of leaking Prisma errors", async () => {
    // 两个玩家同时加入 WAITING 对局，都算出 BLACK 时唯一约束冲突
    prisma.game.findUnique.mockResolvedValue({
      id: "g1",
      code: "ABC234",
      status: "WAITING",
      startedAt: null,
      participants: [{ id: "p1", side: "RED", nickname: "甲", guestIdentityId: "g-a", userId: null }],
    });
    prisma.gameParticipant.create.mockRejectedValue(p2002());

    await expect(service.join(identity, { code: "ABC234", nickname: "乙" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("join does not swallow unrelated errors", async () => {
    prisma.game.findUnique.mockRejectedValue(new Error("db down"));
    await expect(service.join(identity, { code: "ABC234", nickname: "乙" })).rejects.toThrow("db down");
  });

  it("offerDraw is idempotent when the same side already offered", async () => {
    prisma.game.findUnique.mockResolvedValue({
      id: "g1",
      status: "ACTIVE",
      drawOfferedBy: "RED",
      participants: [{ id: "p1", side: "RED", nickname: "甲", guestIdentityId: "g-b", userId: null }],
    });
    await service.offerDraw(identity, { gameId: "g1" });
    expect(prisma.game.update).not.toHaveBeenCalled();
  });

  it("offerDraw writes once when no offer is pending", async () => {
    prisma.game.findUnique.mockResolvedValue({
      id: "g1",
      status: "ACTIVE",
      drawOfferedBy: null,
      participants: [{ id: "p1", side: "RED", nickname: "甲", guestIdentityId: "g-b", userId: null }],
    });
    await service.offerDraw(identity, { gameId: "g1" });
    expect(prisma.game.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { drawOfferedBy: "RED" } });
  });

  it("creates the game and updates the guest nickname in one transaction", async () => {
    prisma.game.create.mockResolvedValue({ id: "g1", code: "ABC234", replayToken: "rt" });

    await expect(service.create(identity, "乙")).resolves.toEqual({ id: "g1", code: "ABC234", replayToken: "rt" });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.guestIdentity.update).toHaveBeenCalledWith({ where: { id: "g-b" }, data: { nickname: "乙" } });
  });

  it("history paginates with a capped page size", async () => {
    const participant = (side: string) => ({
      id: side,
      side,
      nickname: side,
      game: {
        id: "g1",
        code: "ABC234",
        status: "FINISHED",
        winner: null,
        resultReason: "DRAW_AGREEMENT",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        replayToken: "rt",
        participants: [],
      },
    });
    prisma.gameParticipant.findMany.mockResolvedValue([participant("RED"), participant("BLACK")]);
    const result = await service.history(identity, { cursor: "previous", limit: 1 });
    expect(prisma.gameParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "previous" },
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
        skip: 1,
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("RED");
  });
});
