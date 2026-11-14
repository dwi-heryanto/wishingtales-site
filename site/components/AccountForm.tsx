"use client";

import { useEffect, useRef, useState } from "react";
import {
  accountsEnabled,
  currentSession,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signOut,
  signUp,
  syncNow,
  getPrefs,
  getTeenShelf,
  savePrefs,
  setTeenShelf,
  subscribeToDigest,
  type AccountContext,
  type AccountUser,
  type TeenShelfState,
} from "@/lib/accounts";

/*
 * The account surface (ADR-0015, issue #214): register with email + username +
 * password, log in with either identifier, and ask §4.8's context question —
 * a use question, never an identity or age screen. There is no child account
 * and no birthdate field; the copy names it a parent/reader account.
 *
 * Signing in now also merges the guest's local progress up and the account's
 * state back down (ADR-0016's contract) — "those favourites come with you".
 */

type Mode = "create" | "signin";

const CONTEXTS: { id: AccountContext; label: string; hint: string }[] = [
  { id: "family", label: "Reading with kids", hint: "Shelves and (later) digests shaped around read-aloud time." },
  { id: "solo", label: "Reading for myself", hint: "A reading list and streak of your own." },
  { id: "both", label: "Both", hint: "Family shelves plus your own profile." },
];

export function AccountForm() {
  const [enabled] = useState(accountsEnabled);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("create");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [context, setContext] = useState<AccountContext>("solo");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [teen, setTeen] = useState<TeenShelfState | null>(null);
  const [teenPin, setTeenPin] = useState("");
  const [teenError, setTeenError] = useState<string | null>(null);
  const [teenBusy, setTeenBusy] = useState(false);
  const [digest, setDigest] = useState<boolean | null>(null);
  const [digestEmail, setDigestEmail] = useState("");
  const [digestStatus, setDigestStatus] = useState<string | null>(null);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    /*
     * Better Auth's reset link lands on `redirectTo` with `?token=` appended
     * (password.mjs: `redirectCallback(ctx.context, callbackURL, { token })`).
     * The form used to read `?reset=` only, so the reset form could never
     * open — accept both, keeping the old name for links already in the wild.
     */
    const token = params.get("token") ?? params.get("reset");
    if (token) setResetToken(token);
    if (params.get("verified") === "1") {
      setStatus("Email confirmed. Thank you; your account is fully set up.");
      // Drop the query so a refresh does not repeat the notice.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  /* Move focus to the error when one appears — the banner sits under the tabs,
     and a screen-reader reader (or a sighted one) should land on it, not guess. */
  useEffect(() => {
    if (error && errorRef.current) errorRef.current.focus();
  }, [error]);

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    currentSession().then((session) => {
      if (cancelled) return;
      setUser(session);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !user) {
      setTeen(null);
      return;
    }
    let cancelled = false;
    getTeenShelf()
      .then((state) => {
        if (!cancelled) setTeen(state);
      })
      .catch(() => {});
    getPrefs()
      .then((prefs) => {
        if (!cancelled) setDigest(Boolean(prefs?.digest_optin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  function resetErrors() {
    setError(null);
    setStatus(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStep(1);
    resetErrors();
  }

  async function submitSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    resetErrors();
    try {
      const account = await signIn({ identifier: identifier.trim(), password });
      setUser(account);
      await syncNow().catch(() => null);
      setStatus("Signed in. Your progress and favourites are synced.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    setBusy(true);
    resetErrors();
    try {
      const account = await signUp({
        name: email.split("@")[0] ?? "Reader",
        email: email.trim(),
        username: username.trim().toLowerCase(),
        password,
        context,
      });
      setUser(account);
      await syncNow().catch(() => null);
      setStatus("Account created. Guest progress on this device has been merged up.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the account.");
      setStep(1);
    } finally {
      setBusy(false);
    }
  }

  async function logOut() {
    await signOut().catch(() => {});
    setUser(null);
    setStatus("Signed out. Reading as a guest keeps working exactly as before.");
  }

  async function resend() {
    setResendState("sending");
    resetErrors();
    try {
      await resendVerification();
      setResendState("sent");
      setStatus("Confirmation email sent again; check the inbox for this address.");
    } catch (cause) {
      setResendState("idle");
      setError(cause instanceof Error ? cause.message : "Could not send the confirmation email.");
    }
  }

  async function submitReset() {
    if (!resetToken) return;
    setBusy(true);
    resetErrors();
    try {
      await resetPassword({ token: resetToken, password: newPassword });
      setResetToken(null);
      window.history.replaceState(null, "", window.location.pathname);
      setMode("signin");
      setStatus("Password updated. Sign in with it below.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    const email = identifier.trim();
    if (!email.includes("@")) {
      setError(
        "Reset links go to the account’s email address. Type that address above first; a username alone can’t receive mail.",
      );
      return;
    }
    setBusy(true);
    resetErrors();
    try {
      await requestPasswordReset(email);
      setStatus(
        "If that address has an account, a reset link is on its way. Reset mail only goes to confirmed addresses.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a reset link.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTeen(input: { enabled?: boolean; pin?: string | null }) {
    setTeenBusy(true);
    setTeenError(null);
    try {
      setTeen(await setTeenShelf(input));
    } catch (cause) {
      setTeenError(cause instanceof Error ? cause.message : "Could not save the teen-shelf setting.");
    } finally {
      setTeenBusy(false);
    }
  }

  async function submitTeenPin(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(teenPin)) {
      setTeenError("PINs are 4 to 8 digits.");
      return;
    }
    await saveTeen({ pin: teenPin });
    setTeenPin("");
  }

  async function toggleDigest() {
    setDigestBusy(true);
    try {
      const next = digest !== true;
      await savePrefs({ digest_optin: next });
      setDigest(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the digest setting.");
    } finally {
      setDigestBusy(false);
    }
  }

  async function subscribeDigest(event: React.FormEvent) {
    event.preventDefault();
    setDigestBusy(true);
    setDigestError(null);
    try {
      const result = await subscribeToDigest(digestEmail.trim());
      setDigestStatus(
        result.status === "already"
          ? "That address is already on the list."
          : "Check your inbox for the confirmation link.",
      );
      setDigestEmail("");
    } catch (cause) {
      setDigestError(cause instanceof Error ? cause.message : "Could not subscribe that address.");
    } finally {
      setDigestBusy(false);
    }
  }

  if (!enabled) {
    return (
      <p className="account__note">
        Accounts are not enabled on this build yet. Everything is readable as a guest; nothing on
        the site requires an account.
      </p>
    );
  }

  if (checking) {
    return (
      <p className="account__note" aria-live="polite">
        Checking your session…
      </p>
    );
  }

  if (resetToken) {
    return (
      <div className="account">
        <h2 className="account__legend">Choose a new password</h2>
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReset();
          }}
        >
          <label className="account__label" htmlFor="account-reset-password">
            New password
          </label>
          <input
            className="account__input"
            id="account-reset-password"
            name="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <label className="account__choice">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <span className="account__hint">Show password</span>
          </label>
          <p className="account__hint">At least 8 characters.</p>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
        {error ? (
          <p className="account__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (user) {
    return (
      <div className="account">
        <p className="account__signedin">
          Signed in as <strong>{user.email}</strong>
          {user.username ? <> (<code>{user.username}</code>)</> : null}
        </p>
        {user.context ? <p className="account__note">Account type: {user.context}</p> : null}
        {user.emailVerified === false ? (
          <>
            <p className="account__note">
              Email not confirmed yet; check the inbox for {user.email} and click the link. Reset
              mail only goes to confirmed addresses.
            </p>
            <div className="account__actions">
              <button
                className="btn btn--quiet"
                type="button"
                disabled={resendState === "sending" || resendState === "sent"}
                onClick={() => void resend()}
              >
                {resendState === "sent" ? "Confirmation sent" : resendState === "sending" ? "Sending…" : "Resend confirmation email"}
              </button>
            </div>
          </>
        ) : null}
        <p className="account__note">
          Your reading progress and favourites now follow you to any device. Guest reading on
          other devices still works, and signing in there merges it up.
        </p>
        {digest !== null ? (
          <label className="account__choice">
            <input type="checkbox" checked={digest} disabled={digestBusy} onChange={() => void toggleDigest()} />
            <span>
              <strong>Weekly digest email</strong>
              <span className="account__hint"> Tonight&rsquo;s story, what&rsquo;s new, a read-aloud tip. Unsubscribe any time.</span>
            </span>
          </label>
        ) : null}
        <div className="account__teen">
          <h2 className="account__legend">Teen shelf (13+)</h2>
          <p className="account__hint">
            The 13+ shelf and its stories ask every visitor to confirm they are an adult. With
            this account you can skip that notice on devices you trust, and set an optional PIN
            so a child on the same device cannot.
          </p>
          <p className="account__note">
            {teen === null
              ? "Loading…"
              : teen.enabled
                ? "Teen shelf is on for this account."
                : "Teen shelf is off."}
            {teen?.enabled && teen.has_pin ? " A PIN is set." : ""}
          </p>
          <div className="account__actions">
            <button
              className="btn btn--quiet"
              type="button"
              disabled={teenBusy || !teen}
              onClick={() => void saveTeen({ enabled: !teen?.enabled })}
            >
              {teen?.enabled ? "Turn off" : "Turn on"}
            </button>
          </div>
          {teen?.enabled ? (
            <form className="account__form" onSubmit={submitTeenPin}>
              <label className="account__label" htmlFor="teen-pin">
                {teen.has_pin ? "Change or clear the PIN" : "Set an optional PIN (4–8 digits)"}
              </label>
              <input
                className="account__input"
                id="teen-pin"
                name="teen-pin"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                value={teenPin}
                onChange={(event) => setTeenPin(event.target.value)}
                placeholder="····"
              />
              <div className="account__actions">
                <button className="btn btn--quiet" type="submit" disabled={teenBusy || !teenPin}>
                  Save PIN
                </button>
                {teen.has_pin ? (
                  <button
                    className="btn btn--quiet"
                    type="button"
                    disabled={teenBusy}
                    onClick={() => void saveTeen({ pin: null })}
                  >
                    Remove PIN
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
          {teenError ? (
            <p className="account__error" role="alert">
              {teenError}
            </p>
          ) : null}
        </div>
        <button className="btn btn--quiet" type="button" onClick={logOut}>
          Sign out
        </button>
        {status ? (
          <p className="account__status" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account">
      <div className="account__tabs" role="tablist" aria-label="Account action">
        <button
          type="button"
          role="tab"
          id="account-tab-create"
          aria-selected={mode === "create"}
          aria-controls="account-panel"
          className={"account__tab" + (mode === "create" ? " account__tab--on" : "")}
          onClick={() => switchMode("create")}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          id="account-tab-signin"
          aria-selected={mode === "signin"}
          aria-controls="account-panel"
          className={"account__tab" + (mode === "signin" ? " account__tab--on" : "")}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
      </div>

      {/* Status and errors live with the form they belong to, not above the tabs
          (F12), and the error takes focus when it appears. */}
      <div id="account-panel" role="tabpanel" aria-labelledby={mode === "signin" ? "account-tab-signin" : "account-tab-create"}>
        {status ? (
          <p className="account__status" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="account__error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        ) : null}

        {mode === "signin" ? (
        <form className="account__form" onSubmit={submitSignIn}>
          <label className="account__label" htmlFor="account-identifier">
            Email or username
          </label>
          <input
            className="account__input"
            id="account-identifier"
            name="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <label className="account__label" htmlFor="account-password">
            Password
          </label>
          <input
            className="account__input"
            id="account-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {/* WCAG 2.2 / form guidance: let the reader see what they typed. */}
          <label className="account__choice">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <span className="account__hint">Show password</span>
          </label>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button className="btn btn--quiet" type="button" disabled={busy} onClick={forgotPassword}>
            Forgot password?
          </button>
        </form>
      ) : step === 1 ? (
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            resetErrors();
            setStep(2);
          }}
        >
          <label className="account__label" htmlFor="account-email">
            Email
          </label>
          <input
            className="account__input"
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="account__label" htmlFor="account-username">
            Username
          </label>
          <input
            className="account__input"
            id="account-username"
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            /* Matches the server's own validator, `/^[a-zA-Z0-9_.]+$/` (better-auth
               username plugin) with the normalizer applied: lowercase, digits,
               underscores, dots — hyphens are rejected server-side (F4). */
            pattern="[a-z0-9_.]+"
            title="Lowercase letters, digits, underscores or dots."
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label className="account__label" htmlFor="account-new-password">
            Password
          </label>
          <input
            className="account__input"
            id="account-new-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="account__choice">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            <span className="account__hint">Show password</span>
          </label>
          <p className="account__hint">
            At least 8 characters. The username allows lowercase letters, digits, underscores and
            dots; you can sign in with either the email or the username.
          </p>
          <button className="btn btn--primary" type="submit">
            Continue
          </button>
        </form>
      ) : (
        <form
          className="account__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <fieldset className="account__fieldset">
            <legend className="account__legend">How will you use WishingTales?</legend>
            {CONTEXTS.map((option) => (
              <label key={option.id} className="account__choice">
                <input
                  type="radio"
                  name="context"
                  value={option.id}
                  checked={context === option.id}
                  onChange={() => setContext(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="account__hint"> {option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="account__hint">
            WishingTales only ever creates parent/reader accounts. There is no child account and no
            birthdate — this answer just tunes the shelves.
          </p>
          <div className="account__actions">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
            <button className="btn btn--quiet" type="button" disabled={busy} onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
