import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomInt } from "node:crypto";
import { GameStatus, Prisma, Side } from "@prisma/client";
import type {
  DrawResponseInput,
  GameHistory,
  GameState,
  JoinGameInput,
  ReplayData,
  ResignGameInput,
  SubmitMoveInput,
} from "@xiangqi/contracts";
import { PrismaService } from "../database/prisma.service";
import type { RequestIdentity } from "../auth/auth.types";
import { RulesService } from "../rules/rules.service";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const graph = { participants: true, moves: { orderBy: { ply: "asc" as const } } };

type GameGraph = Prisma.GameGetPayload<{ include: typeof graph }>;

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
  ) {}

  async create(identity: RequestIdentity, nickname: string) {
    const initialFen = this.rules.getInitialFen();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const game = await this.prisma.$transaction(async (tx) => {
          const created = await tx.game.create({
            data: {
              code: this.generateCode(),
              initialFen,
              currentFen: initialFen,
              participants: {
                create: {
                  side: "RED",
                  nickname,
                  guestIdentityId: identity.guestId,
                  userId: identity.userId,
                },
              },
            },
          });
          await tx.guestIdentity.update({ where: { id: identity.guestId }, data: { nickname } });
          return created;
        });
        return { id: game.id, code: game.code, replayToken: game.replayToken };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      }
    }
    throw new ConflictException("暂时无法生成唯一对局码，请重试");
  }

  async join(identity: RequestIdentity, input: JoinGameInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({
          where: { code: input.code },
          include: { participants: true },
        });
        if (!game) throw new NotFoundException("对局码不存在");

        const existing = game.participants.find((participant) => this.matches(participant, identity));
        if (existing) {
          if (existing.nickname !== input.nickname) {
            await tx.gameParticipant.update({ where: { id: existing.id }, data: { nickname: input.nickname } });
          }
          await tx.guestIdentity.update({ where: { id: identity.guestId }, data: { nickname: input.nickname } });
          return { id: game.id, code: game.code, side: existing.side };
        }

        if (game.status === "FINISHED") throw new ConflictException("该对局已经结束");
        if (game.participants.length >= 2) throw new ConflictException("该对局已有两名棋手");

        const occupied = new Set(game.participants.map((participant) => participant.side));
        const side: Side = occupied.has("RED") ? "BLACK" : "RED";
        await tx.gameParticipant.create({
          data: {
            gameId: game.id,
            side,
            nickname: input.nickname,
            guestIdentityId: identity.guestId,
            userId: identity.userId,
          },
        });
        await tx.game.update({
          where: { id: game.id },
          data: { status: "ACTIVE", startedAt: game.startedAt ?? new Date() },
        });
        await tx.guestIdentity.update({ where: { id: identity.guestId }, data: { nickname: input.nickname } });
        return { id: game.id, code: game.code, side };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("该对局刚刚已有棋手加入，请刷新后重试");
      }
      throw error;
    }
  }

  async state(gameId: string, identity: RequestIdentity, connectedIdentityKeys = new Set<string>()): Promise<GameState> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, include: graph });
    if (!game) throw new NotFoundException("对局不存在");
    const participant = game.participants.find((item) => this.matches(item, identity));
    if (!participant) throw new ForbiddenException("你不是该对局的棋手");
    return this.toState(game, participant.side, connectedIdentityKeys);
  }

  async move(identity: RequestIdentity, input: SubmitMoveInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const game = await tx.game.findUnique({ where: { id: input.gameId }, include: graph });
        if (!game) throw new NotFoundException("对局不存在");
        const participant = game.participants.find((item) => this.matches(item, identity));
        if (!participant) throw new ForbiddenException("你不是该对局的棋手");
        if (game.status !== "ACTIVE") throw new ConflictException("对局尚未开始或已经结束");
        if (participant.side !== game.turn) throw new ForbiddenException("当前不是你的回合");
        if (game.ply !== input.expectedPly) throw new ConflictException("局面已更新，请按最新局面落子");

        let applied;
        try {
          applied = this.rules.applyMove(game.currentFen, `${input.from}${input.to}`);
        } catch (error) {
          throw new BadRequestException(error instanceof Error ? error.message : "非法落子");
        }

        const terminal = applied.resultReason !== null;
        const updated = await tx.game.updateMany({
          where: { id: game.id, ply: input.expectedPly, status: "ACTIVE", turn: game.turn },
          data: {
            currentFen: applied.fen,
            turn: applied.turn,
            ply: { increment: 1 },
            status: terminal ? "FINISHED" : "ACTIVE",
            winner: applied.winner,
            resultReason: applied.resultReason,
            endedAt: terminal ? new Date() : null,
            drawOfferedBy: null,
          },
        });
        if (updated.count !== 1) throw new ConflictException("该棋步已被其他请求提交");

        await tx.move.create({
          data: {
            gameId: game.id,
            ply: input.expectedPly + 1,
            from: input.from,
            to: input.to,
            notation: applied.notation,
            fenAfter: applied.fen,
          },
        });
        return { gameId: game.id, ended: terminal };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("该棋步已经提交");
      }
      throw error;
    }
  }

  async resign(identity: RequestIdentity, input: ResignGameInput) {
    const game = await this.prisma.game.findUnique({ where: { id: input.gameId }, include: { participants: true } });
    if (!game) throw new NotFoundException("对局不存在");
    const participant = game.participants.find((item) => this.matches(item, identity));
    if (!participant) throw new ForbiddenException("你不是该对局的棋手");
    if (game.status !== "ACTIVE") throw new ConflictException("当前不能认输");
    await this.prisma.game.update({
      where: { id: game.id },
      data: {
        status: "FINISHED",
        winner: participant.side === "RED" ? "BLACK" : "RED",
        resultReason: "RESIGNATION",
        endedAt: new Date(),
        drawOfferedBy: null,
      },
    });
    return { gameId: game.id, ended: true };
  }

  async offerDraw(identity: RequestIdentity, input: ResignGameInput) {
    const { game, participant } = await this.requireActiveParticipant(input.gameId, identity);
    if (game.drawOfferedBy !== participant.side) {
      await this.prisma.game.update({ where: { id: game.id }, data: { drawOfferedBy: participant.side } });
    }
    return { gameId: game.id };
  }

  async respondDraw(identity: RequestIdentity, input: DrawResponseInput) {
    const { game, participant } = await this.requireActiveParticipant(input.gameId, identity);
    if (!game.drawOfferedBy || game.drawOfferedBy === participant.side) {
      throw new ConflictException("当前没有需要你处理的和棋请求");
    }
    await this.prisma.game.update({
      where: { id: game.id },
      data: input.accept
        ? { status: "FINISHED", winner: null, resultReason: "DRAW_AGREEMENT", endedAt: new Date(), drawOfferedBy: null }
        : { drawOfferedBy: null },
    });
    return { gameId: game.id, ended: input.accept };
  }

  async history(identity: RequestIdentity, options: { cursor?: string; limit?: number } = {}): Promise<GameHistory> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const participants = await this.prisma.gameParticipant.findMany({
      where: identity.userId
        ? { OR: [{ userId: identity.userId }, { guestIdentityId: identity.guestId }] }
        : { guestIdentityId: identity.guestId },
      include: { game: { include: { participants: true } } },
      orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      cursor: options.cursor ? { id: options.cursor } : undefined,
      skip: options.cursor ? 1 : 0,
      take: limit + 1,
    });
    const hasMore = participants.length > limit;
    const page = participants.slice(0, limit);
    return {
      hasMore,
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      items: page.map(({ game, side, nickname }) => ({
        id: game.id,
        code: game.code,
        status: game.status,
        opponent: game.participants.find((item) => item.side !== side)?.nickname ?? null,
        nickname,
        playerSide: side,
        winner: game.winner,
        resultReason: game.resultReason,
        updatedAt: game.updatedAt.toISOString(),
        replayToken: game.status === "FINISHED" ? game.replayToken : null,
      })),
    };
  }

  async replay(token: string): Promise<ReplayData> {
    const game = await this.prisma.game.findUnique({ where: { replayToken: token }, include: graph });
    if (!game) throw new NotFoundException("复盘记录不存在");
    return {
      id: game.id,
      code: game.code,
      initialFen: game.initialFen,
      status: game.status,
      winner: game.winner,
      resultReason: game.resultReason,
      startedAt: game.startedAt?.toISOString() ?? null,
      endedAt: game.endedAt?.toISOString() ?? null,
      players: game.participants.map((item) => ({ side: item.side, nickname: item.nickname, connected: false })),
      moves: game.moves.map((move) => ({
        ply: move.ply,
        from: move.from,
        to: move.to,
        notation: move.notation,
        fenAfter: move.fenAfter,
        createdAt: move.createdAt.toISOString(),
      })),
    };
  }

  private toState(game: GameGraph, playerSide: Side, connectedIdentityKeys: Set<string>): GameState {
    const canMove = game.status === "ACTIVE" && game.turn === playerSide;
    return {
      id: game.id,
      code: game.code,
      status: game.status,
      fen: game.currentFen,
      turn: game.turn,
      ply: game.ply,
      playerSide,
      legalMoves: canMove ? this.rules.getLegalMoves(game.currentFen) : [],
      inCheck: this.rules.isCheck(game.currentFen),
      players: game.participants.map((item) => ({
        side: item.side,
        nickname: item.nickname,
        connected: connectedIdentityKeys.has(`g:${item.guestIdentityId}`)
          || (!!item.userId && connectedIdentityKeys.has(`u:${item.userId}`)),
      })),
      winner: game.winner,
      resultReason: game.resultReason,
      drawOfferedBy: game.drawOfferedBy,
      replayToken: game.status === "FINISHED" ? game.replayToken : null,
    };
  }

  private async requireActiveParticipant(gameId: string, identity: RequestIdentity) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, include: { participants: true } });
    if (!game) throw new NotFoundException("对局不存在");
    const participant = game.participants.find((item) => this.matches(item, identity));
    if (!participant) throw new ForbiddenException("你不是该对局的棋手");
    if (game.status !== "ACTIVE") throw new ConflictException("对局当前不在进行中");
    return { game, participant };
  }

  private matches(participant: { guestIdentityId: string; userId: string | null }, identity: RequestIdentity) {
    return participant.guestIdentityId === identity.guestId || (!!identity.userId && participant.userId === identity.userId);
  }

  private generateCode() {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]!;
    }
    return code;
  }
}
