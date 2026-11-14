/**
 * The site-side accounts client (ADR-0015, issue #214).
 *
 * Fetch + sessionStorage only — the Worker's `/api/auth/*` and `/api/sync`
 * are bearer-token APIs, the same transport the studio uses. The bearer
 * token lives in sessionStorage (not a cookie: the site and the Worker are
 * different origins, and Safari's third-party cookie blocking makes
 * `SameSite=None` fragile).
 *
 * Everything is feature-flagged by `NEXT_PUBLIC_ACCOUNTS_API` at build time.
 * Unset means the account page says accounts are not enabled and no header
 * link renders, so the live site stays guest-only until the Worker deploy
 * that ships them. The guest experience never consults this module.
 */

export const ACCOUNTS_API = (process.env.NEXT_PUBLIC_ACCOUNTS_API ?? "").replace(/\/$/, "");

export function accountsEnabled(): boolean {
  return ACCOUNTS_API.length > 0;
}

const TOKEN_KEY = "wt:token";

export type AccountContext = "family" | "solo" | "both";

export type AccountUser = {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role?: string;
  context?: AccountContext;
  emailVerified?: boolean;
};

type ProgressEntry = { pct: number; at: number; title: string; url: string };
type ProgressMap = Record<string, ProgressEntry>;

/** The sync payload's shape, mirrored from worker/src/accounts.ts. */
export interface SyncState {
  progress: Record<string, { position: number; completed: boolean }>;
  favorites: string[];
  prefs: Record<string, string | boolean>;
}

export class AccountsError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AccountsError";
    this.code = code;
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the session just will not survive a tab close */
  }
}

export function hasSessionToken(): boolean {
  return readToken() !== null;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const token = readToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${ACCOUNTS_API}${path}`, { ...init, headers });
}

async function errorFrom(response: Response, fallback: string): Promise<AccountsError> {
  const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
  const code = body?.code;
  /*
   * Map the auth server's codes to copy a reader can act on (issue #208's
   * account-flow probe — F6/F7). Raw server text leaks zod paths
   * ("[body.email] Invalid email address") and says "Failed to create user"
   * for both a taken email and a taken username, which tells nobody which
   * field to change. Unknown codes fall back to the server message.
   */
  const friendly: Record<string, string> = {
    VALIDATION_ERROR: "That email address does not look right; check it and try again.",
    PASSWORD_TOO_SHORT: "Passwords need at least 8 characters.",
    INVALID_USERNAME:
      "Usernames are 3–30 characters: lowercase letters, digits, underscores or dots.",
    USERNAME_TOO_SHORT: "Usernames need at least 3 characters.",
    USERNAME_TOO_LONG: "Usernames can be at most 30 characters.",
    USERNAME_IS_ALREADY_TAKEN: "That username is already in use; try another one.",
    USER_ALREADY_EXISTS: "An account with that email already exists. Sign in instead?",
    FAILED_TO_CREATE_USER:
      "That email or username is already in use. Try signing in, or pick a different username.",
    INVALID_EMAIL_OR_PASSWORD: "That email or username and password do not match.",
    INVALID_USERNAME_OR_PASSWORD: "That username and password do not match.",
    INVALID_TOKEN: "That link has expired or was already used. Ask for a fresh one.",
  };
  const message = (code && friendly[code]) || body?.message || fallback;
  return new AccountsError(message, code);
}

/** Register with email + username + password; the context question rides the same call. */
export async function signUp(input: {
  name: string;
  email: string;
  username: string;
  password: string;
  context: AccountContext;
}): Promise<AccountUser> {
  const response = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      // Where the confirmation link lands when it is clicked — a dedicated
      // page so the result is visible immediately (ADR-0015).
      callbackURL:
        typeof location !== "undefined" ? `${location.origin}/account/verified/` : undefined,
    }),
  });
  if (!response.ok) throw await errorFrom(response, "Could not create the account.");
  const body = (await response.json()) as { token?: string; user: AccountUser };
  if (body.token) writeToken(body.token);
  return body.user;
}

/** Log in with either identifier — the username plugin accepts both endpoints. */
export async function signIn(input: { identifier: string; password: string }): Promise<AccountUser> {
  const trimmed = input.identifier.trim();
  const isEmail = trimmed.includes("@");
  const response = await api(isEmail ? "/api/auth/sign-in/email" : "/api/auth/sign-in/username", {
    method: "POST",
    body: JSON.stringify(
      isEmail
        ? { email: trimmed, password: input.password }
        : /* Usernames are stored lowercased by the plugin's normalizer; the
             sign-in lookup is not normalised, so typed capitals would miss. */
          { username: trimmed.toLowerCase(), password: input.password },
    ),
  });
  if (!response.ok) throw await errorFrom(response, "That email or username and password do not match.");
  const body = (await response.json()) as { token?: string; user: AccountUser };
  if (body.token) writeToken(body.token);
  return body.user;
}

/**
 * Re-send the verification mail (F8: there was no way to ask for another one).
 * The endpoint is a no-op when the address is already verified, so the button
 * is only rendered for unverified sessions anyway.
 */
export async function resendVerification(): Promise<void> {
  const response = await api("/api/auth/send-verification-email", {
    method: "POST",
    body: JSON.stringify({
      callbackURL:
        typeof location !== "undefined" ? `${location.origin}/account/verified/` : undefined,
    }),
  });
  if (!response.ok) throw await errorFrom(response, "Could not send the confirmation email.");
}

export async function signOut(): Promise<void> {
  try {
    await api("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
  } finally {
    writeToken(null);
  }
}

/** The signed-in user, or null. A dead token is cleared, not retried. */
export async function currentSession(): Promise<AccountUser | null> {
  if (!accountsEnabled() || !readToken()) return null;
  try {
    const response = await api("/api/auth/get-session");
    if (response.status === 401) {
      writeToken(null);
      return null;
    }
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as { user?: AccountUser } | null;
    return body?.user ?? null;
  } catch {
    return null;
  }
}

/** Ask for a reset link. The Worker only mails verified addresses (ADR-0015). */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await api("/api/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({
      email,
      redirectTo: typeof location !== "undefined" ? `${location.origin}/account/` : undefined,
    }),
  });
  if (!response.ok) throw await errorFrom(response, "Could not request a reset link.");
}

/** Complete the reset with the one-time token from the email link. */
export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const response = await api("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ newPassword: input.password, token: input.token }),
  });
  if (!response.ok) throw await errorFrom(response, "Could not reset the password.");
}

// ---------------------------------------------------------------------------
// The guest-state contract (ADR-0016): local shapes are the site's existing
// keys, mapped at the boundary. Mapping is pure and exported so the merge
// rules stay testable without a browser.
// ---------------------------------------------------------------------------

export function readLocalProgress(): ProgressMap {
  try {
    const raw = JSON.parse(localStorage.getItem("wt:progress") ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function readLocalFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem("wt:favorites") ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((slug): slug is string => typeof slug === "string") : [];
  } catch {
    return [];
  }
}

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const THEMES = new Set(["light", "sepia", "dusk", "dark"]);

/** Local guest state → the sync payload (ADR-0016's mapping: pct → position 0..1). */
export function buildSyncPayload(): {
  progress: Record<string, { position: number; completed: boolean }>;
  favorites: string[];
  prefs: Record<string, string>;
} {
  const progress: Record<string, { position: number; completed: boolean }> = {};
  for (const [slug, entry] of Object.entries(readLocalProgress())) {
    const pct = Number(entry?.pct ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    progress[slug] = {
      position: Math.min(1, Math.max(0, pct / 100)),
      // 95%+ is finished for a family story night; the same threshold the
      // continue-reading rail uses to hide a story.
      completed: pct >= 95,
    };
  }
  const prefs: Record<string, string> = {};
  const theme = readPref("wt:theme");
  if (theme && THEMES.has(theme)) prefs.theme = theme;
  const scale = readPref("wt:scale");
  if (scale) prefs.text_size = scale;
  const leading = readPref("wt:leading");
  if (leading) prefs.spacing = leading;
  return { progress, favorites: readLocalFavorites(), prefs };
}

/**
 * Write the server's merged progress back into `wt:progress` without losing
 * the local title/url the shelves need. Only slugs the device already knows
 * are touched — a server-only slug has no title to render, so inventing an
 * entry would put a blank card on the shelf.
 */
export function applyServerProgress(local: ProgressMap, server: SyncState["progress"]): ProgressMap {
  const next: ProgressMap = { ...local };
  for (const [slug, state] of Object.entries(server)) {
    const existing = next[slug];
    if (!existing) continue;
    const serverPct = state.completed ? 100 : Math.round(state.position * 100);
    if (serverPct > existing.pct) {
      next[slug] = { ...existing, pct: serverPct, at: Date.now() };
    }
  }
  return next;
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/**
 * One round trip: merge local guest state up, apply the merged result back
 * down. Called on sign-in and on page load while a token exists.
 */
export async function syncNow(): Promise<SyncState | null> {
  if (!accountsEnabled() || !readToken()) return null;
  const response = await api("/api/sync", { method: "POST", body: JSON.stringify(buildSyncPayload()) });
  if (!response.ok) return null;
  const state = (await response.json()) as SyncState;

  const merged = applyServerProgress(readLocalProgress(), state.progress);
  writeJSON("wt:progress", merged);
  if (state.favorites.length > 0) {
    const union = [...new Set([...readLocalFavorites(), ...state.favorites])];
    writeJSON("wt:favorites", union);
  }
  return state;
}

// ---------------------------------------------------------------------------
// The teen shelf (ADR-0015 §4.3): an account-level toggle plus an optional
// PIN, both server-side. Cosmetic by design — the gate is a speed bump, not
// enforcement; it decides which adults the notice lets through.
// ---------------------------------------------------------------------------

export type TeenShelfState = { enabled: boolean; has_pin: boolean };

export async function getTeenShelf(): Promise<TeenShelfState | null> {
  if (!accountsEnabled() || !readToken()) return null;
  try {
    const response = await api("/api/account/teen");
    if (!response.ok) return null;
    return (await response.json()) as TeenShelfState;
  } catch {
    return null;
  }
}

export async function setTeenShelf(input: { enabled?: boolean; pin?: string | null }): Promise<TeenShelfState> {
  const response = await api("/api/account/teen", { method: "POST", body: JSON.stringify(input) });
  if (!response.ok) throw await errorFrom(response, "Could not save the teen-shelf setting.");
  return (await response.json()) as TeenShelfState;
}

export async function verifyTeenPin(pin: string): Promise<boolean> {
  const response = await api("/api/account/teen/verify", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  if (!response.ok) return false;
  const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
  return body?.ok === true;
}

// ---------------------------------------------------------------------------
// The parent digest (ADR-0017): double opt-in for guests, an account opt-in
// flag for signed-in readers. Both feed the same weekly send.
// ---------------------------------------------------------------------------

/** Double opt-in: the response is "sent" and the mail carries the confirmation link. */
export async function subscribeToDigest(email: string): Promise<{ status: string }> {
  const response = await api("/api/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw await errorFrom(response, "Could not subscribe that address.");
  return (await response.json()) as { status: string };
}

/** The account's synced preferences, for the digest checkbox. */
export async function getPrefs(): Promise<Record<string, string | boolean> | null> {
  if (!accountsEnabled() || !readToken()) return null;
  try {
    const response = await api("/api/sync");
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as SyncState | null;
    return body?.prefs ?? null;
  } catch {
    return null;
  }
}

/** Saves preference keys one at a time — the server merges per key (ADR-0015). */
export async function savePrefs(prefs: Record<string, string | boolean>): Promise<void> {
  const response = await api("/api/sync", { method: "POST", body: JSON.stringify({ prefs }) });
  if (!response.ok) throw await errorFrom(response, "Could not save your preferences.");
}
