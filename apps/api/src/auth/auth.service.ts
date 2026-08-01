import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { argon2id, hash as hashPassword, verify as verifyPassword } from "argon2";
import { parse as parseCookie } from "cookie";
import type { LoginInput, RegisterInput } from "@xiangqi/contracts";
import { PrismaService } from "../database/prisma.service";
import type { RequestIdentity } from "./auth.types";

const COOKIE_NAME = "xq_session";
const SESSION_DAYS = 30;
const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.cleanupSessions();
    const timer = setInterval(() => void this.cleanupSessions(), SESSION_CLEANUP_INTERVAL_MS);
    timer.unref?.();
  }

  async ensureHttpSession(req: Request, res: Response): Promise<RequestIdentity> {
    const existing = req.cookies?.[COOKIE_NAME] as string | undefined;
    const identity = existing ? await this.resolveRawToken(existing) : null;
    if (identity) return identity;

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        tokenHash: this.digest(rawToken),
        expiresAt,
        guestIdentity: {
          create: { tokenHash: this.digest(`guest:${randomUUID()}`) },
        },
      },
      include: { user: true },
    });

    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      expires: expiresAt,
      path: "/",
    });

    return {
      sessionId: session.id,
      guestId: session.guestIdentityId,
      userId: null,
      username: null,
    };
  }

  async resolveSocketCookie(cookieHeader: string | undefined): Promise<RequestIdentity | null> {
    if (!cookieHeader) return null;
    const raw = parseCookie(cookieHeader)[COOKIE_NAME];
    return raw ? this.resolveRawToken(raw) : null;
  }

  async register(identity: RequestIdentity, input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictException("用户名已被使用");

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          passwordHash: await hashPassword(input.password, { type: argon2id }),
        },
      });
      await tx.session.update({ where: { id: identity.sessionId }, data: { userId: created.id } });
      await tx.guestIdentity.update({
        where: { id: identity.guestId },
        data: { claimedById: created.id },
      });
      await tx.gameParticipant.updateMany({
        where: { guestIdentityId: identity.guestId, userId: null },
        data: { userId: created.id },
      });
      return created;
    });

    return { id: user.id, username: user.username };
  }

  async login(identity: RequestIdentity, input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException("用户名或密码错误");
    }

    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: identity.sessionId }, data: { userId: user.id } }),
      this.prisma.guestIdentity.update({
        where: { id: identity.guestId },
        data: { claimedById: user.id },
      }),
      this.prisma.gameParticipant.updateMany({
        where: { guestIdentityId: identity.guestId, userId: null },
        data: { userId: user.id },
      }),
    ]);

    return { id: user.id, username: user.username };
  }

  async logout(identity: RequestIdentity) {
    await this.prisma.session.update({ where: { id: identity.sessionId }, data: { userId: null } });
    return { ok: true };
  }

  /** 删除已过期会话及不再被任何会话/对局引用的孤儿游客身份，防止 Session 表无限增长。 */
  private async cleanupSessions() {
    try {
      await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await this.prisma.guestIdentity.deleteMany({
        where: { sessions: { none: {} }, participants: { none: {} } },
      });
    } catch {
      // 清理是尽力而为的后台任务，失败不应影响主流程
    }
  }

  private async resolveRawToken(rawToken: string): Promise<RequestIdentity | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.digest(rawToken) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) return null;
    return {
      sessionId: session.id,
      guestId: session.guestIdentityId,
      userId: session.userId,
      username: session.user?.username ?? null,
    };
  }

  private digest(value: string) {
    const secret = process.env.SESSION_SECRET ?? "development-only-session-secret-change-me";
    return createHmac("sha256", secret).update(value).digest("hex");
  }
}
