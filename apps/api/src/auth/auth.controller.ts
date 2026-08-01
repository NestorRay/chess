import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { loginSchema, registerSchema } from "@xiangqi/contracts";
import { AuthService } from "./auth.service";
import { AuthThrottleGuard } from "./throttle.guard";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  me(@Req() req: Request) {
    return req.identity.userId
      ? { user: { id: req.identity.userId, username: req.identity.username } }
      : { user: null };
  }

  @Post("register")
  @UseGuards(AuthThrottleGuard)
  register(@Req() req: Request, @Body() body: unknown) {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message);
    return this.auth.register(req.identity, parsed.data);
  }

  @Post("login")
  @UseGuards(AuthThrottleGuard)
  login(@Req() req: Request, @Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message);
    return this.auth.login(req.identity, parsed.data);
  }

  @Post("logout")
  logout(@Req() req: Request) {
    return this.auth.logout(req.identity);
  }
}
