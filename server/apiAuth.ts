import { timingSafeEqual } from "node:crypto";

export function isAuthorizedApiKey(authorization: string | undefined) {
  const configured = process.env.OBEDIANCE_API_KEY;
  if (!configured || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length).trim();
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
