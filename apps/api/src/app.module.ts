import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "node:path";
import { AppController } from "./app.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { SessionMiddleware } from "./auth/session.middleware";
import { PrismaService } from "./database/prisma.service";
import { GamesController } from "./games/games.controller";
import { GamesGateway } from "./games/games.gateway";
import { GamesService } from "./games/games.service";
import { RulesService } from "./rules/rules.service";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "public"),
      exclude: ["/api/{*path}", "/socket.io/{*path}"],
    }),
  ],
  controllers: [AppController, AuthController, GamesController],
  providers: [PrismaService, AuthService, RulesService, GamesService, GamesGateway, SessionMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionMiddleware)
      .exclude({ path: "api/health", method: RequestMethod.GET })
      .forRoutes({ path: "api/{*path}", method: RequestMethod.ALL });
  }
}
