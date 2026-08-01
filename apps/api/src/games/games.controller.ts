import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { createGameSchema } from "@xiangqi/contracts";
import { GamesService } from "./games.service";

@Controller("api")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post("games")
  create(@Req() req: Request, @Body() body: unknown) {
    const parsed = createGameSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message);
    return this.games.create(req.identity, parsed.data.nickname);
  }

  @Get("games/:id")
  state(@Req() req: Request, @Param("id") id: string) {
    return this.games.state(id, req.identity);
  }

  @Get("history")
  history(@Req() req: Request) {
    return this.games.history(req.identity);
  }

  @Get("replays/:token")
  replay(@Param("token") token: string) {
    return this.games.replay(token);
  }
}
