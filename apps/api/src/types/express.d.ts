import type { RequestIdentity } from "../auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      identity: RequestIdentity;
    }
  }
}

export {};
