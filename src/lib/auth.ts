import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import { pool } from "@/lib/db";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const developmentSecret = "development-only-secret-change-before-deployment-000000";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const auth = betterAuth({
  appName: "Groundwork Land Registry",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? developmentSecret,
  database: pool,
  trustedOrigins: [process.env.APP_URL ?? baseURL],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 5,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    twoFactor({ issuer: "Groundwork Uganda Land Registry" }),
  ],
});