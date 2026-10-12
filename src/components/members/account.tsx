import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Shell, fieldClass } from "@/components/shell";
import { membersOn } from "@/lib/members/config";
import { errorText, membersCopy } from "@/lib/members/copy";
import { pagesCopy } from "@/lib/members/pages-copy";
import { homeLink, memberPageLink, readLink } from "@/lib/lang-path";
import { safeBack } from "@/lib/members/rules";
import { isPaid, refreshProfile, supabase, useMember } from "@/lib/members/session";
import { formatDate, storyTitle } from "@/lib/text";
import { copyFor } from "@/lib/i18n";
import { useHistory } from "@/lib/reads";
import { findCard } from "@/lib/seed";
import type { Lang } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

function backFromAddress(): string | null {
  try {
    return safeBack(new URLSearchParams(window.location.search).get("back"));
  } catch {
    return null;
  }
}

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center bg-ink px-5 text-sm text-paper disabled:opacity-50";
export const quietButtonClass =
  "inline-flex min-h-11 items-center text-sm text-pine underline-offset-4 hover:underline disabled:opacity-50";

/** The account page: sign in, or the member's name, membership and sign-out. */
export function AccountPage() {
  const lang = useLang();
  const words = membersCopy(lang);
  return (
    <Shell>
      <main className="px-5 py-10 md:px-12 md:py-14">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl md:text-4xl">{words.account}</h1>
          </div>
          <Account lang={lang} />
        </div>
      </main>
    </Shell>
  );
}

function Account({ lang }: { lang: Lang }) {
  const words = membersCopy(lang);
  const member = useMember();
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => setBack(backFromAddress()), []);
  // Back from a "forgot your password" e-mail: the new password comes first.
  const [reset, setReset] = useState(false);
  useEffect(() => setReset(new URLSearchParams(window.location.search).get("reset") === "1"), []);

  if (!membersOn || member.status === "off") {
    const soon = pagesCopy(lang);
    return (
      <div className="flex flex-col gap-4 border-y border-line py-6">
        <p>{soon.accountSoon}</p>
        <Link
          {...memberPageLink(lang, "membership")}
          className="inline-flex min-h-11 items-center self-start text-pine"
        >
          {soon.seePlans}
        </Link>
      </div>
    );
  }
  if (member.status === "loading") return <p className="text-muted">{words.loading}</p>;
  if (member.status === "out") return <SignIn lang={lang} />;

  const profile = member.profile;
  const status =
    profile?.role === "editor"
      ? words.editor
      : isPaid(profile) && profile?.paid_until
        ? words.paid(formatDate(profile.paid_until.slice(0, 10), lang))
        : null; // a free member sees no label: membership is simply theirs

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl">{words.welcome(profile?.display_name?.trim() ?? "")}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          {back ? (
            <a href={back} className={buttonClass}>
              {words.backToReading}
            </a>
          ) : null}
          <Link {...homeLink(lang)} className={back ? quietButtonClass : buttonClass}>
            {words.backToHome}
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-y border-line py-5">
        <p dir="ltr" className="text-start">
          {member.user.email}
        </p>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>
      <History lang={lang} userId={member.user.id} />
      {reset ? <PasswordForm lang={lang} first /> : null}
      {/* The name and the password stay folded, like the language list, so the page stays
          calm; a reader who came from the reset e-mail gets the open form above instead. */}
      <div className="flex flex-col border-b border-line">
        <Fold label={words.name}>
          <NameForm
            lang={lang}
            userId={member.user.id}
            current={profile?.display_name ?? ""}
            folded
          />
        </Fold>
        {!reset ? (
          <Fold label={words.changePassword}>
            <PasswordForm lang={lang} first={false} />
          </Fold>
        ) : null}
      </div>
      {profile?.role === "editor" ? (
        <Link to="/editor" className="inline-flex min-h-11 items-center self-start text-pine">
          Editör paneli
        </Link>
      ) : null}
      <button
        type="button"
        className={`${quietButtonClass} self-start`}
        onClick={() => void supabase().then((client) => client.auth.signOut())}
      >
        {words.signOut}
      </button>
    </div>
  );
}

/** "today", "yesterday" or the date, for the line under a reading in the history. */
function whenRead(iso: string, lang: Lang, now = new Date()): string {
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const read = new Date(iso);
  if (day(read) === day(now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day(read) === day(yesterday)) return "yesterday";
  const local = `${read.getFullYear()}-${String(read.getMonth() + 1).padStart(2, "0")}-${String(read.getDate()).padStart(2, "0")}`;
  return formatDate(local, lang);
}

/** The member's reading history, newest first, with a way to clear it. */
/** A folded row: the label with a caret, the content sliding open under it on a tap. */
function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="group flex min-h-12 w-full items-center justify-between gap-4 text-start"
      >
        <span>{label}</span>
        <svg
          viewBox="0 0 8 5"
          className="size-2.5 shrink-0 opacity-70 transition-transform duration-200 group-aria-expanded:rotate-180"
          aria-hidden="true"
        >
          <path d="M.75.75 4 4.25 7.25.75" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="pb-5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function History({ lang, userId }: { lang: Lang; userId: string }) {
  const words = membersCopy(lang);
  const copy = copyFor(lang);
  const { entries, available, clear } = useHistory(userId);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const label =
    lang === "ar" ? "text-sm text-pine" : "text-xs uppercase tracking-[0.14em] text-pine";
  const rows = (entries ?? [])
    .map((entry) => ({ entry, card: findCard(entry.storyId) }))
    .filter((row) => row.card !== undefined);

  if (!available) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="history">
      <h2 id="history" className={`border-b-[3px] border-ink pb-3 font-body font-normal ${label}`}>
        {words.history}
      </h2>
      {entries === null ? (
        <p className="text-muted">{words.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">{words.historyEmpty}</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {rows.map(({ entry, card }) =>
              card ? (
                <li key={entry.storyId} className="flex flex-col gap-1 border-b border-line py-3">
                  <Link
                    {...readLink(lang, card.id)}
                    className="paper-title text-lg font-bold leading-snug text-ink"
                  >
                    {storyTitle(card, lang)}
                  </Link>
                  <span className="flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
                    <span className={label}>{copy.themes[card.theme]}</span>
                    <span>{words.readOn(whenRead(entry.readAt, lang))}</span>
                  </span>
                </li>
              ) : null,
            )}
          </ul>
          {asking ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-sm">{words.clearAsk}</span>
              <button
                type="button"
                className={quietButtonClass}
                onClick={() =>
                  void clear().then((done) => {
                    setAsking(false);
                    setError(done ? "" : words.errors.generic);
                  })
                }
              >
                {words.clearYes}
              </button>
              <button type="button" className={quietButtonClass} onClick={() => setAsking(false)}>
                {words.clearNo}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${quietButtonClass} self-start`}
              onClick={() => setAsking(true)}
            >
              {words.clearHistory}
            </button>
          )}
          {error ? (
            <p role="alert" className="text-sm text-pine">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The name shown on the member's comments. */
export function NameForm({
  lang,
  userId,
  current,
  onSaved,
  folded = false,
}: {
  lang: Lang;
  userId: string;
  current: string;
  onSaved?: () => void;
  /** Inside a fold the row above already names the field, so its label is for screen readers only. */
  folded?: boolean;
}) {
  const words = membersCopy(lang);
  const [name, setName] = useState(current);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(current), [current]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (value.length < 2 || value.length > 40) {
      setNote(words.nameHint);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const client = await supabase();
      const { error } = await client
        .from("profiles")
        .update({ display_name: value })
        .eq("id", userId);
      if (error) throw error;
      await refreshProfile();
      setNote(words.saved);
      onSaved?.();
    } catch (error) {
      setNote(errorText(error, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className={folded ? "sr-only" : "text-sm"}>{words.name}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoComplete="nickname"
          className={fieldClass()}
        />
      </label>
      <p className="text-xs text-muted">{words.nameHint}</p>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={busy} className={buttonClass}>
          {words.save}
        </button>
        {note ? (
          <p role="status" className="text-sm text-muted">
            {note}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Where a link from an e-mail brings the reader back: this account page. */
function accountAddress(extra = ""): string {
  return `${window.location.origin}${window.location.pathname}${extra}`;
}

type Step = "signin" | "join" | "forgot";

/**
 * Sign in, join or reset a forgotten password. Joining takes an e-mail and a password;
 * Supabase sends a confirmation link, and the membership is complete once it is tapped.
 * Signing in afterwards takes the e-mail and the password, nothing else.
 */
function SignIn({ lang }: { lang: Lang }) {
  const words = membersCopy(lang);
  const [step, setStep] = useState<Step>("signin");
  // Arriving from a "Join Free" button: the join form comes first.
  useEffect(() => {
    try {
      const join = new URLSearchParams(window.location.search).get("join");
      if (join === "true" || join === "1") setStep("join");
    } catch {
      /* sign-in stays first */
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const choose = (next: Step) => {
    setStep(next);
    setError("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    if (step !== "forgot" && password.length < 8) {
      setError(words.errors.weakPassword);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const client = await supabase();
      if (step === "signin") {
        const { error } = await client.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
      } else if (step === "join") {
        const { data, error } = await client.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: accountAddress() },
        });
        if (error) throw error;
        // An address that is already a member comes back with no sign-in methods.
        if (data.user && (data.user.identities ?? []).length === 0) {
          setError(words.errors.alreadyMember);
          return;
        }
        setSent(words.sentConfirm(address));
      } else {
        const { error } = await client.auth.resetPasswordForEmail(address, {
          redirectTo: accountAddress("?reset=1"),
        });
        if (error) throw error;
        setSent(words.sentReset(address));
      }
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl">{words.checkEmail}</h2>
        <p className="text-muted">{sent}</p>
        <button
          type="button"
          className={`${quietButtonClass} self-start`}
          onClick={() => {
            setSent(null);
            choose("signin");
          }}
        >
          {words.back}
        </button>
      </div>
    );
  }

  const tab = (choice: "signin" | "join") => (
    <button
      key={choice}
      type="button"
      role="tab"
      aria-selected={step === choice}
      onClick={() => choose(choice)}
      className={`-mb-px min-h-11 border-b-2 text-xl ${
        step === choice ? "border-ink text-ink" : "border-transparent text-muted"
      }`}
    >
      {choice === "join" ? words.join : words.signIn}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      {step === "forgot" ? (
        <h2 className="text-xl">{words.forgot}</h2>
      ) : (
        <div role="tablist" className="flex gap-8 border-b border-line">
          {tab("signin")}
          {tab("join")}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-muted">
          {step === "join"
            ? words.joinIntro
            : step === "forgot"
              ? words.forgotIntro
              : words.signInIntro}
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-sm">{words.email}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            dir="ltr"
            className={fieldClass()}
          />
        </label>
        {step !== "forgot" ? (
          <label className="flex flex-col gap-2">
            <span className="text-sm">{words.password}</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={step === "join" ? "new-password" : "current-password"}
              dir="ltr"
              className={fieldClass()}
            />
            {step === "join" ? (
              <span className="text-xs text-muted">{words.passwordHint}</span>
            ) : null}
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button type="submit" disabled={busy} className={buttonClass}>
            {step === "join" ? words.join : step === "forgot" ? words.sendReset : words.signIn}
          </button>
          {step === "signin" ? (
            <button type="button" className={quietButtonClass} onClick={() => choose("forgot")}>
              {words.forgot}
            </button>
          ) : null}
          {step === "forgot" ? (
            <button type="button" className={quietButtonClass} onClick={() => choose("signin")}>
              {words.back}
            </button>
          ) : null}
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-pine">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sets or changes the member's password. Opened first when the reader comes back from a
 * "forgot your password" e-mail (the address then ends in ?reset=1).
 */
function PasswordForm({ lang, first }: { lang: Lang; first: boolean }) {
  const words = membersCopy(lang);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setNote(words.errors.weakPassword);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const client = await supabase();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setNote(words.passwordSaved);
      if (first) window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      setNote(errorText(error, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="text-sm">{words.newPassword}</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          autoComplete="new-password"
          autoFocus={first}
          dir="ltr"
          className={fieldClass()}
        />
      </label>
      <p className="text-xs text-muted">
        {first ? `${words.newPasswordIntro} ` : ""}
        {words.passwordHint}
      </p>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={busy} className={buttonClass}>
          {words.save}
        </button>
        {note ? (
          <p role="status" className="text-sm text-muted">
            {note}
          </p>
        ) : null}
      </div>
    </form>
  );
}
