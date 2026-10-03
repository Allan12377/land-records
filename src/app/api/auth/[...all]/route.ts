import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { notifySignIn } from "@/lib/notifications";

const authHandler = toNextJsHandler(auth);
export const GET = authHandler.GET;

export async function POST(request: Request) {
	const isEmailSignIn = new URL(request.url).pathname.endsWith("/sign-in/email");
	const attemptedEmail = isEmailSignIn
		? String((await request.clone().json().catch(() => ({})) as { email?: unknown }).email ?? "").trim().slice(0, 320)
		: "";
	const response = await authHandler.POST(request);
	if (isEmailSignIn && attemptedEmail && (response.ok || [401, 403, 422, 429].includes(response.status))) {
		const result = await response.clone().json().catch(() => ({})) as { twoFactorRedirect?: boolean };
		await notifySignIn({ email: attemptedEmail, succeeded: response.ok && !result.twoFactorRedirect, challenged: response.ok && result.twoFactorRedirect, request });
	}
	return response;
}