import { config as loadDotEnv } from "dotenv";

loadDotEnv();

const NUMERIC_ID_RE = /^-?\d+$/;
const DEFAULT_DEDUPE_WINDOW_MS = 300_000;

export interface ApiConfig {
  apiId: number;
  apiHash: string;
}

export interface ClientConfig extends ApiConfig {
  sessionString: string;
}

export interface ObserverConfig extends ClientConfig {
  alertTargetChatId: string;
  alertMentionUsernames: string[];
  monitoredChatIds: Set<string>;
  triggerKeywordsJson?: string;
  dedupeWindowMs: number;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseApiId(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("API_ID must be positive integer");
  }
  return parsed;
}

function parseNumericId(value: string, name: string): string {
  if (!NUMERIC_ID_RE.test(value)) {
    throw new Error(`${name} must be numeric Telegram ID, got: ${value}`);
  }
  return value;
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseMonitoredChatIds(value: string): Set<string> {
  const ids = parseCommaSeparated(value);
  if (ids.length === 0) {
    throw new Error("MONITORED_CHAT_IDS must include at least one chat ID");
  }

  const normalized = new Set<string>();
  for (const chatId of ids) {
    normalized.add(parseNumericId(chatId, "MONITORED_CHAT_IDS"));
  }
  return normalized;
}

function normalizeMention(username: string): string {
  const stripped = username.startsWith("@") ? username.slice(1) : username;
  if (!/^[A-Za-z0-9_]{5,32}$/.test(stripped)) {
    throw new Error(
      `ALERT_MENTION_USERNAMES contains invalid username: ${username}`
    );
  }
  return `@${stripped}`;
}

function parseMentions(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return parseCommaSeparated(value).map(normalizeMention);
}

function parseDedupeWindowMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_DEDUPE_WINDOW_MS;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("DEDUPE_WINDOW_MS must be positive integer");
  }
  return parsed;
}

export function loadApiConfig(): ApiConfig {
  return {
    apiId: parseApiId(requiredEnv("API_ID")),
    apiHash: requiredEnv("API_HASH"),
  };
}

export function loadClientConfig(): ClientConfig {
  return {
    ...loadApiConfig(),
    sessionString: requiredEnv("SESSION_STRING"),
  };
}

export function loadObserverConfig(): ObserverConfig {
  return {
    ...loadClientConfig(),
    alertTargetChatId: parseNumericId(
      requiredEnv("ALERT_TARGET_CHAT_ID"),
      "ALERT_TARGET_CHAT_ID"
    ),
    alertMentionUsernames: parseMentions(optionalEnv("ALERT_MENTION_USERNAMES")),
    monitoredChatIds: parseMonitoredChatIds(requiredEnv("MONITORED_CHAT_IDS")),
    triggerKeywordsJson: optionalEnv("TRIGGER_KEYWORDS_JSON"),
    dedupeWindowMs: parseDedupeWindowMs(optionalEnv("DEDUPE_WINDOW_MS")),
  };
}

