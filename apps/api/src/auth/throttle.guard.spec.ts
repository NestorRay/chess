import { beforeEach, describe, expect, it } from "vitest";
import { HttpException } from "@nestjs/common";
import { AuthThrottleGuard } from "./throttle.guard";

function context(ip: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ ip }) }) } as never;
}

describe("AuthThrottleGuard", () => {
  let guard: AuthThrottleGuard;

  beforeEach(() => {
    guard = new AuthThrottleGuard();
  });

  it("allows requests under the limit", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(guard.canActivate(context("1.2.3.4"))).toBe(true);
    }
  });

  it("rejects the 21st request from the same ip", () => {
    for (let index = 0; index < 20; index += 1) guard.canActivate(context("1.2.3.4"));
    expect(() => guard.canActivate(context("1.2.3.4"))).toThrow(HttpException);
  });

  it("tracks different ips independently", () => {
    for (let index = 0; index < 20; index += 1) guard.canActivate(context("1.2.3.4"));
    expect(guard.canActivate(context("5.6.7.8"))).toBe(true);
  });
});
