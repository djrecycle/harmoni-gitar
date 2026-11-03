import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";

/**
 * Who is allowed to create this account. There is no public sign-up: every account is created inside
 * `signupContext.run(...)` by trusted server code:
 *  - "setup":      `npm run setup:teacher` (the first teacher)
 *  - "invitation": a student opening a valid invitation link (stage 1)
 *  - "teacher":    a signed-in teacher creating an account by hand (stage 1)
 * Anything else, such as calling /api/auth/sign-up/email directly, is rejected in `databaseHooks.user.create.before`.
 */
export type SignupContext = { via: "setup" | "invitation" | "teacher"; role: Role; mustChangePassword?: boolean };
export const signupContext = new AsyncLocalStorage<SignupContext>();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // First layer: the public sign-up endpoint is switched off. Accounts are made with admin.createUser on the server.
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      // input:false -> the client can never set these through a public endpoint
      role: { type: "string", required: false, defaultValue: "student", input: false },
      isAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Second layer: no trusted context -> no account, whichever endpoint was used.
        before: async (u) => {
          const ctx = signupContext.getStore();
          if (!ctx) throw new APIError("FORBIDDEN", { message: "Public sign-up is disabled. Ask your teacher for an invitation link." });
          let isAdmin = false;
          if (ctx.role === "teacher") {
            const exists = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.role, "teacher")).limit(1);
            isAdmin = exists.length === 0; // first teacher = main admin
          }
          return { data: { ...u, role: ctx.role, isAdmin, mustChangePassword: ctx.mustChangePassword ?? false } };
        },
      },
    },
  },
  plugins: [
    // Students sign in with a username (no email needed for children).
    username({ minUsernameLength: 3, maxUsernameLength: 24, displayUsername: false }),
    // admin.createUser makes an account without starting a session for it (the teacher stays signed in), and
    // `banned` keeps inactive students out. adminRoles is empty: none of the /api/auth/admin/* endpoints can
    // be called over HTTP; the app calls them only from its own server code after its own role checks.
    admin({ defaultRole: "student", adminRoles: [] }),
    nextCookies(), // must stay last: it needs to see the final response to set cookies
  ],
});
