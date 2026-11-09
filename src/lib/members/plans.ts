import type { Lang } from "../types.ts";

/**
 * Paid membership: the periods and their prices, in one place.
 *
 * Every language shows the same dollar prices. The currency lists only the periods it
 * offers, in the order the payment page shows them; the first is chosen first.
 *
 * `checkoutUrl` stays empty until the payment provider approves the site. While it is
 * empty the payment page shows the plans and the total, and its button waits with a short
 * note. Once filled, the button opens the provider's checkout with `?plan=…` added.
 */
export type Period = "monthly" | "quarterly" | "halfyear" | "yearly";
export type Currency = "USD";

export const PAYMENT: {
  prices: Record<Currency, Partial<Record<Period, number>>>;
  checkoutUrl: string;
} = {
  prices: {
    USD: { quarterly: 5, halfyear: 7, yearly: 10 },
  },
  checkoutUrl: "",
};

const ORDER: readonly Period[] = ["monthly", "quarterly", "halfyear", "yearly"];

export const paymentOn: boolean = PAYMENT.checkoutUrl.startsWith("https://");

const LOCALE: Record<Lang, string> = {
  tr: "tr-TR",
  ar: "ar",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
};

/** The currency of a language's pages. */
export function currencyFor(_lang: Lang): Currency {
  return "USD";
}

/** The periods offered on a language's pages, shortest first. */
export function periodsFor(lang: Lang): Period[] {
  const prices = PAYMENT.prices[currencyFor(lang)];
  return ORDER.filter((period) => typeof prices[period] === "number");
}

/** A period's price as the reader's language writes it: $5, 5 $, … */
export function price(period: Period, lang: Lang): string {
  const currency = currencyFor(lang);
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(PAYMENT.prices[currency][period] ?? 0);
}

export function isPeriod(value: unknown): value is Period {
  return (ORDER as readonly unknown[]).includes(value);
}
