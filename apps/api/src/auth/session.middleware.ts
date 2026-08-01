import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      req.identity = await this.auth.ensureHttpSession(req, res);
      next();
    } catch (error) {
      next(error);
    }
  }
}
