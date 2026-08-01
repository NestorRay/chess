import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService session cleanup", () => {
  it("removes unreferenced guest identities even after they were claimed", async () => {
    const prisma = {
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      guestIdentity: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new AuthService(prisma as never);

    await (service as unknown as { cleanupSessions: () => Promise<void> }).cleanupSessions();

    expect(prisma.guestIdentity.deleteMany).toHaveBeenCalledWith({
      where: { sessions: { none: {} }, participants: { none: {} } },
    });
  });
});
