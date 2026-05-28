// Server-only: reads and validates the environment the run route needs.
// Throws a clear, actionable EnvError if a required var is missing so the
// route can surface it as a friendly banner instead of a stack trace.

import "server-only";

export interface Env {
  apiKey: string;
  model: string;
  customerId: string;
  /** Gateway base URL (OpenAI-compatible), e.g. https://api.respan.ai/api */
  baseUrl: string;
  /** Management API base for the SDK; undefined uses the SDK's own default. */
  apiBaseUrl: string | undefined;
  /** Base URL of the Respan dashboard, used for "view in Respan" deep links. */
  dashboardUrl: string;
  pricePer1k: number;
}

const DEFAULT_BASE_URL = "https://api.respan.ai/api";
const DEFAULT_DASHBOARD_URL = "https://app.respan.ai";
const DEFAULT_CUSTOMER_ID = "promptarena";
const DEFAULT_PRICE_PER_1K = 0.005;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

export function getEnv(): Env {
  const apiKey = process.env.RESPAN_API_KEY?.trim();
  const model = process.env.RESPAN_MODEL?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push("RESPAN_API_KEY");
  if (!model) missing.push("RESPAN_MODEL");
  if (missing.length > 0) {
    throw new EnvError(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local, fill them in, and restart the dev server.`,
    );
  }

  const parsedPrice = Number(process.env.RESPAN_PRICE_PER_1K_TOKENS);
  return {
    apiKey: apiKey as string,
    model: model as string,
    customerId: process.env.RESPAN_CUSTOMER_ID?.trim() || DEFAULT_CUSTOMER_ID,
    baseUrl: process.env.RESPAN_BASE_URL?.trim() || DEFAULT_BASE_URL,
    apiBaseUrl: process.env.RESPAN_API_BASE_URL?.trim() || undefined,
    dashboardUrl: (process.env.RESPAN_DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL).replace(/\/+$/, ""),
    pricePer1k:
      Number.isFinite(parsedPrice) && parsedPrice > 0
        ? parsedPrice
        : DEFAULT_PRICE_PER_1K,
  };
}
