import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import { buttonClass } from "@/components/members/account";
import { membersOn } from "@/lib/members/config";
import { accountLink, legalLink, memberPageLink } from "@/lib/lang-path";
import { legalCopy } from "@/lib/legal-copy";
import { pagesCopy } from "@/lib/members/pages-copy";
import {
  PAYMENT,
  currencyFor,
  isPeriod,
  paymentOn,
  periodsFor,
  price,
  type Period,
} from "@/lib/members/plans";
import type { Lang } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

/** The same small label a reading uses for "Related readings". */
function sectionHead(_lang: Lang) {
  // The headings at the foot of a reading (Documents, Related readings) set the pattern.
  return "plain-head";
}

const outlineButton =
  "inline-flex min-h-11 items-center justify-center border border-ink px-5 text-sm text-ink transition-colors duration-150 hover:bg-ink hover:text-paper";

/** Same column and way back as the About page, set like a reading. */
function Page({
  title,
  lead,
  parent,
  children,
}: {
  title: string;
  lead: string;
  /** A page between Home and this one in the trail at the top. */
  parent?: (className: string) => React.ReactNode;
  children: React.ReactNode;
}) {
  const lang = useLang();
  return (
    <Shell>
      <main className="page-plain">
        <div className="flex flex-col gap-8">
          <Trail lang={lang} here={title} parent={parent} className="-mb-3" />
          <header className="flex flex-col gap-4">
            <h1 className="page-title">{title}</h1>
            <p className="page-lead">{lead}</p>
          </header>
          <div className="flex flex-col gap-10 border-t border-rule pt-8">{children}</div>
        </div>
      </main>
    </Shell>
  );
}

/** The numbered points. `under` when a rule already stands right above them (the page's or
 *  a heading's), so they start under it instead of under a second, thinner one. */
function Points({ items, under = false }: { items: string[]; under?: boolean }) {
  return (
    <ol className={under ? "" : "mt-6 border-t border-line"}>
      {items.map((item, index) => (
        <li
          key={item}
          className="grid grid-cols-[1.75rem_1fr] items-baseline gap-2 border-b border-line py-3.5 text-lg leading-snug"
        >
          <span aria-hidden="true" className="font-display text-2xl font-semibold leading-none text-pine">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** The supporting membership's prices: the first large, the others after it. */
function PriceList({ lang }: { lang: Lang }) {
  const words = pagesCopy(lang).membership;
  const [first, ...rest] = periodsFor(lang);
  if (!first) return null;
  return (
    <div className="mt-6 flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="paper-title text-4xl font-bold leading-none tabular-nums lining-nums">
          {price(first, lang)}
        </span>
        <span className="text-sm text-muted">/ {words.per[first]}</span>
      </p>
      {rest.length ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-muted">
          {rest.map((period, i) => (
            <span key={period} className="inline-flex items-baseline gap-x-2">
              {i === 0 ? (
                <span className="text-sm">{words.or}</span>
              ) : (
                <span aria-hidden="true">·</span>
              )}
              <span className="paper-title text-2xl font-bold leading-none text-ink tabular-nums lining-nums">
                {price(period, lang)}
              </span>
              <span className="text-sm">/ {words.per[period]}</span>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** A button that is not open yet: its name, dimmed, and "soon" beside it. */
function Soon({ label, soon, className }: { label: string; soon: string; className: string }) {
  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span aria-disabled="true" className={`${className} pointer-events-none opacity-50`}>
        {label}
      </span>
      <span className="text-sm text-pine">{soon}</span>
    </p>
  );
}

/**
 * /membership. While there is no payment, only the free membership: what it gives and the
 * "Join Free" button. Once a payment provider is set, the free and the supporting membership
 * stand side by side, stacked on a phone.
 */
export function MembershipPage() {
  const lang = useLang();
  const words = pagesCopy(lang).membership;
  if (!paymentOn) return <FreeMembership lang={lang} />;
  return (
    <Page title={words.title} lead={words.lead}>
      <div className="grid md:grid-cols-2 md:gap-12">
        <section className="flex flex-col border-b border-line pb-8 md:border-b-0 md:pb-2">
          <h2 className={sectionHead(lang)}>{words.free.name}</h2>
          <p className="paper-title mt-6 text-4xl font-bold leading-none">{words.free.price}</p>
          <Points items={words.free.points} />
          {membersOn ? (
            <Link
              {...accountLink(lang, undefined, true)}
              className={`${outlineButton} mt-8 self-start`}
            >
              {words.free.action}
            </Link>
          ) : (
            <Soon label={words.free.action} soon={words.soon} className={outlineButton} />
          )}
        </section>
        <section className="-mx-5 flex flex-col bg-shade px-5 py-8 md:mx-0 md:px-8">
          <h2 className={sectionHead(lang)}>{words.paid.name}</h2>
          <PriceList lang={lang} />
          <Points items={words.paid.points} />
          {paymentOn ? (
            <Link {...memberPageLink(lang, "payment")} className={`${buttonClass} mt-8 self-start`}>
              {words.paid.action}
            </Link>
          ) : (
            <Soon label={words.paid.action} soon={words.soon} className={buttonClass} />
          )}
        </section>
      </div>
      <p className="border-t border-line pt-6 text-sm text-muted">
        {words.haveAccount}{" "}
        {membersOn ? (
          <Link
            {...accountLink(lang)}
            className="text-pine underline underline-offset-4 hover:underline"
          >
            {words.signIn}
          </Link>
        ) : (
          <>
            {words.signIn}
            <span className="ms-2 text-pine">{words.soon}</span>
          </>
        )}
      </p>
    </Page>
  );
}

/** The free membership alone: the reading history, comments and newsletter it brings. */
function FreeMembership({ lang }: { lang: Lang }) {
  const words = pagesCopy(lang).membership;
  return (
    <Page title={words.heading} lead={words.freeLead}>
      <section className="flex max-w-xl flex-col">
        <Points items={words.free.points} under />
        {membersOn ? (
          <Link
            {...accountLink(lang, undefined, true)}
            className={`${buttonClass} mt-8 self-start`}
          >
            {words.free.action}
          </Link>
        ) : (
          <Soon label={words.free.action} soon={words.soon} className={buttonClass} />
        )}
      </section>
      <p className="max-w-xl border-t border-line pt-6 text-sm text-muted">
        {words.haveAccount}{" "}
        {membersOn ? (
          <Link
            {...accountLink(lang)}
            className="text-pine underline underline-offset-4 hover:underline"
          >
            {words.signIn}
          </Link>
        ) : (
          words.signIn
        )}
      </p>
    </Page>
  );
}

/** The period in the address (?plan=yearly), read after the page opens; else the first offered. */
function usePeriod(lang: Lang): [Period, (period: Period) => void] {
  const offered = periodsFor(lang);
  const [period, setPeriod] = useState<Period>(offered[0] ?? "yearly");
  useEffect(() => {
    try {
      const plan = new URLSearchParams(window.location.search).get("plan");
      if (isPeriod(plan) && periodsFor(lang).includes(plan)) setPeriod(plan);
    } catch {
      /* the default period stands */
    }
  }, [lang]);
  return [period, setPeriod];
}

function checkoutHref(period: Period, lang: Lang): string {
  const url = new URL(PAYMENT.checkoutUrl);
  url.searchParams.set("plan", period);
  url.searchParams.set("lang", lang);
  url.searchParams.set("currency", currencyFor(lang));
  return url.toString();
}

/** /payment: choose a period, see the total, go on to the provider's checkout. */
export function PaymentPage() {
  const lang = useLang();
  const all = pagesCopy(lang);
  const words = all.payment;
  const legal = legalCopy(lang);
  const [period, setPeriod] = usePeriod(lang);
  const per = all.membership.per[period];

  const option = (value: Period, name: string, note?: string) => (
    <label
      key={value}
      className={`flex min-h-16 cursor-pointer items-center gap-4 border-b border-line px-3 py-4 ${period === value ? "bg-shade" : ""}`}
    >
      <input
        type="radio"
        name="period"
        value={value}
        checked={period === value}
        onChange={() => setPeriod(value)}
        className="size-4 shrink-0 accent-[var(--color-ink)]"
      />
      <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[17px]">
          {name}
          {note ? <span className="ms-3 text-sm text-pine">{note}</span> : null}
        </span>
        <span className="tabular-nums">
          {price(value, lang)} <span className="text-muted">/ {all.membership.per[value]}</span>
        </span>
      </span>
    </label>
  );

  return (
    <Page
      title={words.title}
      lead={words.lead}
      parent={(className) => (
        <Link {...memberPageLink(lang, "membership")} className={className}>
          {all.membership.title}
        </Link>
      )}
    >
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
        <div className="flex min-w-0 flex-col gap-10">
          <fieldset className="flex flex-col border-t border-line">
            <legend className="sr-only">{words.period}</legend>
            {periodsFor(lang).map((value) =>
              option(
                value,
                words.periods[value],
                value === "yearly" ? words.yearlyNote[currencyFor(lang)] : undefined,
              ),
            )}
          </fieldset>
          <section className="flex flex-col">
            <h2 className={sectionHead(lang)}>{words.includes}</h2>
            <Points items={all.membership.paid.points} under />
          </section>
        </div>

        <aside className="flex flex-col gap-5 self-start bg-shade px-6 py-7 md:sticky md:top-8">
          <h2 className={sectionHead(lang)}>{words.summary}</h2>
          <div className="flex flex-col gap-1">
            <p className="paper-title text-xl font-bold leading-snug">{words.plan}</p>
            <p className="text-sm text-muted">{words.periods[period]}</p>
          </div>
          <p className="flex items-baseline justify-between gap-4 border-t border-line pt-4">
            <span className="text-sm text-muted">{words.total}</span>
            <span className="text-end tabular-nums">
              <span className="paper-title text-3xl font-bold leading-none lining-nums">
                {price(period, lang)}
              </span>{" "}
              <span className="text-sm text-muted">/ {per}</span>
            </span>
          </p>
          {paymentOn ? (
            <a href={checkoutHref(period, lang)} className={`${buttonClass} w-full`}>
              {words.pay}
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-describedby="payment-waiting"
                className={`${buttonClass} w-full`}
              >
                {words.pay}
              </button>
              <p id="payment-waiting" className="text-sm leading-snug text-muted">
                {words.waiting}
              </p>
            </>
          )}
          <p className="text-sm text-muted">
            {legal.agree[0]}{" "}
            <Link
              {...legalLink(lang, "terms")}
              className="text-pine underline-offset-4 hover:underline"
            >
              {legal.terms.title.toLocaleLowerCase(lang)}
            </Link>
            {lang === "tr" ? " " : ""}
            {legal.agree[1]}
          </p>
        </aside>
      </div>
      <Link
        {...memberPageLink(lang, "membership")}
        className="inline-flex min-h-11 items-center self-start text-sm text-pine"
      >
        {words.back}
      </Link>
    </Page>
  );
}

/** /newsletter: what the newsletter will be, and that it opens soon. */
export function NewsletterPage() {
  const lang = useLang();
  const words = pagesCopy(lang).newsletter;
  return (
    <Page title={words.title} lead={words.lead}>
      <div className="flex max-w-2xl gap-4 border-b border-line pb-8">
        <span
          aria-hidden="true"
          className="relative mt-1 inline-flex h-10 w-3 shrink-0 justify-center"
        >
          <span className="absolute h-10 w-px bg-ink" />
          <span className="mt-[15px] size-2 rounded-full bg-ink" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="paper-title text-xl font-bold md:text-2xl">{words.soon}</p>
          <p className="text-muted">{words.soonNote}</p>
        </div>
      </div>
    </Page>
  );
}
