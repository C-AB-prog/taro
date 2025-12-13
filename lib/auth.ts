import "server-only";
import { jwtVerify, SignJWT } from "jose";

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET_MISSING");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: { userId: string }) {
  const key = getKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifySession(token: string): Promise<{ userId: string }> {
  const key = getKey();
  const { payload } = await jwtVerify(token, key);
  const userId = (payload as any)?.userId;
  if (!userId || typeof userId !== "string") throw new Error("BAD_SESSION");
  return { userId };
}
