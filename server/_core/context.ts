import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

const MOCK_AUTH_ENABLED = process.env.NODE_ENV !== "production" && process.env.OBEDIANCE_MOCK_AUTH === "1";
const MOCK_AUTH_ROLE: User["role"] = process.env.OBEDIANCE_MOCK_AUTH_ROLE === "admin" ? "admin" : "user";

function buildMockUser(): User {
  const now = new Date();
  const id = Number(process.env.OBEDIANCE_MOCK_USER_ID ?? "1");
  return {
    id: Number.isInteger(id) && id > 0 ? id : 1,
    openId: process.env.OBEDIANCE_MOCK_OPEN_ID || "mock-local-user",
    name: process.env.OBEDIANCE_MOCK_NAME || "Local Test Operator",
    email: process.env.OBEDIANCE_MOCK_EMAIL || "local.operator@example.test",
    loginMethod: "mock",
    role: MOCK_AUTH_ROLE,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (MOCK_AUTH_ENABLED) {
    user = buildMockUser();
  } else try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
