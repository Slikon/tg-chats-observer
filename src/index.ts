import { Api, TelegramClient, utils } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { StringSession } from "telegram/sessions";
import { loadObserverConfig } from "./config";
import { findMatchedKeywords, resolveTriggerKeywords } from "./keywords";

const config = loadObserverConfig();
const triggerKeywords = resolveTriggerKeywords(config.triggerKeywordsJson);
const dedupeCache = new Map<string, number>();

const client = new TelegramClient(
  new StringSession(config.sessionString),
  config.apiId,
  config.apiHash,
  { connectionRetries: 5 }
);

function pruneDedupeCache(now: number): void {
  for (const [key, timestamp] of dedupeCache.entries()) {
    if (now - timestamp >= config.dedupeWindowMs) {
      dedupeCache.delete(key);
    }
  }
}

function isDuplicate(chatId: string, normalizedText: string, now: number): boolean {
  const dedupeKey = `${chatId}::${normalizedText}`;
  const previousTimestamp = dedupeCache.get(dedupeKey);
  dedupeCache.set(dedupeKey, now);
  return (
    typeof previousTimestamp === "number" &&
    now - previousTimestamp < config.dedupeWindowMs
  );
}

function getChatLabel(chat: unknown, fallbackChatId: string): string {
  if (chat instanceof Api.Channel || chat instanceof Api.Chat) {
    return chat.title ?? fallbackChatId;
  }
  if (chat instanceof Api.User) {
    const parts = [chat.firstName, chat.lastName].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" ");
    }
    if (chat.username) {
      return `@${chat.username}`;
    }
  }
  return fallbackChatId;
}

function getSenderLabel(sender: unknown): string {
  if (sender instanceof Api.User) {
    const name = [sender.firstName, sender.lastName].filter(Boolean).join(" ");
    if (name) {
      return name;
    }
    if (sender.username) {
      return `@${sender.username}`;
    }
    return sender.id.toString();
  }
  if (sender instanceof Api.Channel || sender instanceof Api.Chat) {
    return sender.title ?? sender.id.toString();
  }
  return "unknown";
}

function buildMessageLink(chat: unknown, chatId: string, messageId: number): string {
  if (chat instanceof Api.Channel && chat.username) {
    return `https://t.me/${chat.username}/${messageId}`;
  }
  if (chatId.startsWith("-100")) {
    return `https://t.me/c/${chatId.slice(4)}/${messageId}`;
  }
  return "N/A";
}

async function onNewMessage(event: NewMessageEvent): Promise<void> {
  const message = event.message;
  if (message.media) {
    return;
  }

  const text = message.message?.trim();
  if (!text) {
    return;
  }

  const chatId = utils.getPeerId(message.peerId);
  if (!config.monitoredChatIds.has(chatId)) {
    return;
  }

  const normalizedText = text.toLowerCase();
  const matchedKeywords = findMatchedKeywords(normalizedText, triggerKeywords);
  if (matchedKeywords.length === 0) {
    return;
  }

  const now = Date.now();
  pruneDedupeCache(now);
  if (isDuplicate(chatId, normalizedText, now)) {
    return;
  }

  const chat = await event.getChat();
  const sender = await message.getSender();
  const mentionLine = config.alertMentionUsernames.join(" ").trim();
  const chatLabel = getChatLabel(chat, chatId);
  const senderLabel = getSenderLabel(sender);
  const messageLink = buildMessageLink(chat, chatId, message.id);
  const timestamp = new Date(message.date * 1_000).toISOString();

  const lines = [
    mentionLine,
    "Observer keyword hit",
    `Chat: ${chatLabel} (${chatId})`,
    `Sender: ${senderLabel}`,
    `Matched: ${matchedKeywords.join(", ")}`,
    `Time: ${timestamp}`,
    `Link: ${messageLink}`,
    "",
    "Text:",
    text,
  ].filter((line, index) => index === 0 || line.length > 0);

  await client.sendMessage(config.alertTargetChatId, {
    message: lines.join("\n"),
  });

  console.log(
    `[ALERT] chat=${chatId} sender=${senderLabel} matched=${matchedKeywords.join(",")}`
  );
}

async function main(): Promise<void> {
  await client.connect();
  const isAuthorized = await client.checkAuthorization();
  if (!isAuthorized) {
    throw new Error("Session is not authorized. Run: npm run session:init");
  }
  await client.getMe();

  client.addEventHandler(
    (event) => {
      void onNewMessage(event).catch((error: unknown) => {
        console.error("Failed handling message:", error);
      });
    },
    new NewMessage({ incoming: true })
  );

  console.log(
    `Observer running. Monitored chats: ${Array.from(config.monitoredChatIds).join(", ")}`
  );

  await new Promise<void>(() => {
    // Keep process alive and event handlers active.
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
