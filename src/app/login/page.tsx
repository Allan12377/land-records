"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";

type LoginMode = "password" | "challenge" | "challenge-backup" | "enroll" | "verify-enrollment";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [enrollmentPassword, setEnrollmentPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function completeAuthentication() {
    const session = await fetch("/api/session?setup=1", { cache: "no-store" });
    if (!session.ok) throw new Error("This account does not have registry administrator access.");
    const data = await session.json() as { user: { twoFactorEnabled: boolean } };
    if (!data.user.twoFactorEnabled) {
      setMode("enroll");
      return;
    }
    router.replace("/dashboard");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          rememberMe: true,
        }),
      });
      const result = await response.json().catch(() => ({})) as { twoFactorRedirect?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message ?? "The email or password was not accepted. Check your details and try again.");
      if (result.twoFactorRedirect) {
        setMode("challenge");
        return;
      }
      await completeAuthentication();
      setEnrollmentPassword(String(form.get("password") ?? ""));
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enrollmentPassword, method: "totp" }),
      });
      const result = await response.json() as { totpURI?: string; backupCodes?: string[]; message?: string };
      if (!response.ok || !result.totpURI || !result.backupCodes?.length) {
        throw new Error(result.message ?? "Could not start authenticator setup.");
      }
      setTotpUri(result.totpURI);
      setBackupCodes(result.backupCodes);
      setMode("verify-enrollment");
    } catch (enrollmentError) {
      setError(enrollmentError instanceof Error ? enrollmentError.message : "Could not start authenticator setup.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: String(form.get("code") ?? "").trim(), trustDevice: true }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The authenticator code was not accepted.");
      await completeAuthentication();
      setEnrollmentPassword("");
      setBackupCodes([]);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "The authenticator code was not accepted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyBackupCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/verify-backup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: String(form.get("code") ?? "").trim(), trustDevice: true }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "The backup code was not accepted.");
      await completeAuthentication();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "The backup code was not accepted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <Link className="brand login-brand" href="/">
          <span className="brand-mark"><Building2 size={20} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>Groundwork</strong><small>LAND REGISTRY</small></span>
        </Link>
        <div className="login-editorial">
          <span className="login-kicker">UGANDA · LAND RECORDS</span>
          <h1>Every parcel.<br />A record you<br /><em>can trust.</em></h1>
          <p>One considered place for people, parcels, and the paper trail that connects them.</p>
          <div className="login-landmark"><span className="landmark-line" /><span>REGISTRY WORKSPACE <i /> PRIVATE ACCESS</span></div>
        </div>
        <div className="login-footer"><span>GROUNDWORK REGISTRY</span><span>ADMINISTRATOR ACCESS ONLY</span></div>
      </section>

      <section className="login-main">
        <div className="login-card">
          <div className="login-heading-icon"><ShieldCheck size={20} /></div>
          {mode === "password" && <>
            <span className="login-kicker">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Use the administrator account provided by your organization.</p>
            <form className="login-form" onSubmit={signIn}>
              <label className="form-field"><span>Email address</span><input name="email" type="email" autoComplete="username" required placeholder="name@organization.org" /></label>
              <label className="form-field"><span>Password</span><span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Checking access…" : "Sign in"}{!submitting && <ArrowRight size={16} />}</button>
            </form>
            <div className="login-security"><ShieldCheck size={15} /><span>Administrator sign-in requires an authenticator app.</span></div>
          </>}

          {mode === "challenge" && <>
            <span className="login-kicker">SECOND STEP</span>
            <h2>Verify it’s you</h2>
            <p>Enter the six-digit code from your authenticator app.</p>
            <form className="login-form" onSubmit={verifyTotp}>
              <label className="form-field"><span>Authenticator code</span><input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" autoFocus /></label>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Verify and continue"}{!submitting && <ArrowRight size={16} />}</button>
            </form>
            <button type="button" className="login-backup-link" onClick={() => { setError(""); setMode("challenge-backup"); }}>Use a saved backup code</button>
          </>}

          {mode === "challenge-backup" && <>
            <span className="login-kicker">ACCOUNT RECOVERY</span>
            <h2>Use a backup code</h2>
            <p>Enter one unused backup code saved during authenticator setup.</p>
            <form className="login-form" onSubmit={verifyBackupCode}>
              <label className="form-field"><span>Backup code</span><input name="code" type="text" autoComplete="one-time-code" minLength={8} maxLength={24} required placeholder="XXXX-XXXX" autoFocus /></label>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Checking code…" : "Verify backup code"}{!submitting && <ArrowRight size={16} />}</button>
            </form>
            <button type="button" className="login-backup-link" onClick={() => { setError(""); setMode("challenge"); }}>Use authenticator instead</button>
          </>}

          {mode === "enroll" && <>
            <span className="login-kicker">ACCOUNT SECURITY</span>
            <h2>Set up your authenticator</h2>
            <p>Administrator accounts must use an authenticator app before registry access is enabled.</p>
            <form className="login-form" onSubmit={beginEnrollment}>
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Preparing setup…" : "Set up authenticator"}{!submitting && <ArrowRight size={16} />}</button>
              {error && <div className="login-error" role="alert">{error}</div>}
            </form>
            <div className="login-security"><ShieldCheck size={15} /><span>Install an authenticator app before continuing.</span></div>
          </>}

          {mode === "verify-enrollment" && <>
            <span className="login-kicker">AUTHENTICATOR SETUP</span>
            <h2>Scan, save, verify</h2>
            <p>Scan this QR code with your authenticator app, then store the backup codes somewhere private.</p>
            <div className="totp-qr"><QRCodeSVG value={totpUri} size={180} level="M" includeMargin /></div>
            <div className="backup-code-grid">{backupCodes.map((code) => <code key={code}>{code}</code>)}</div>
            <form className="login-form" onSubmit={verifyTotp}>
              <label className="form-field"><span>Six-digit authenticator code</span><input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" /></label>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Verifying setup…" : "Verify and secure account"}{!submitting && <ArrowRight size={16} />}</button>
            </form>
          </>}
        </div>
        <div className="login-bottom-note">Need access? Contact your registry administrator.</div>
      </section>
    </main>
  );
}