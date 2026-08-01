import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { createGameSchema } from "@xiangqi/contracts";
import { GamesGateway } from "./games.gateway";
import { GamesService } from "./games.service";

@Controller("api")
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly gateway: GamesGateway,
  ) {}

  @Post("games")
  create(@Req() req: Request, @Body() body: unknown) {
    const parsed = createGameSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message);
    return this.games.create(req.identity, parsed.data.nickname);
  }

  @Get("games/:id")
  async state(@Req() req: Request, @Param("id") id: string) {
    const connectedIdentityKeys = await this.gateway.connectedIdentityKeysFor(id);
    return this.games.state(id, req.identity, connectedIdentityKeys);
  }

  @Get("history")
  history(@Req() req: Request, @Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    const parsedLimit = Number.parseInt(limit ?? "", 10);
    return this.games.history(req.identity, {
      cursor: cursor || undefined,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
    });
  }

  @Get("replays/:token")
  replay(@Param("token") token: string) {
    return this.games.replay(token);
  }
}
