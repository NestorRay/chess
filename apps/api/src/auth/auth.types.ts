export interface RequestIdentity {
  sessionId: string;
  guestId: string;
  userId: string | null;
  username: string | null;
}
