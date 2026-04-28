# Telegram Bot Observer

Telegram user-session observer (GramJS/MTProto) for incoming text messages in allowlisted chats.  
When message contains trigger keywords, app sends alert to configured Telegram chat/channel and tags configured usernames.

## Features

- User session auth (`SESSION_STRING`) via interactive bootstrap
- Incoming messages only (`NewMessage` with `incoming: true`)
- Allowlist by `MONITORED_CHAT_IDS`
- Text-only scanning (media messages skipped)
- Case-insensitive substring keyword matching
- Built-in keywords + optional `TRIGGER_KEYWORDS_JSON` override merge
- In-memory dedupe window (`DEDUPE_WINDOW_MS`, default 5 min)
- Alert payload with chat, sender, matches, time, and message link
- Dialog listing helper to collect chat IDs
- Docker support

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template:
   ```bash
   cp .env.example .env
   ```
3. Fill `.env` with your Telegram API credentials (`API_ID`, `API_HASH`) from https://my.telegram.org.
4. Initialize user session:
   ```bash
   npm run session:init
   ```
   This command writes `SESSION_STRING` to `.env`.
5. List dialogs and pick chat IDs for allowlist:
   ```bash
   npm run dialogs:list
   ```
6. Put selected IDs into `MONITORED_CHAT_IDS` and set `ALERT_TARGET_CHAT_ID`.
7. Start observer:
   ```bash
   npm run start
   ```

## Environment variables

- `API_ID` - Telegram app API ID
- `API_HASH` - Telegram app API hash
- `SESSION_STRING` - user session string from `npm run session:init`
- `ALERT_TARGET_CHAT_ID` - numeric target chat/channel ID for alerts
- `ALERT_MENTION_USERNAMES` - comma-separated usernames (with or without `@`)
- `MONITORED_CHAT_IDS` - comma-separated numeric chat IDs to observe
- `TRIGGER_KEYWORDS_JSON` - optional JSON array of extra keywords
- `DEDUPE_WINDOW_MS` - dedupe time window in milliseconds (default `300000`)

## Build

```bash
npm run build
```

# Docker

Build image:

```bash
docker build -t telegram-bot-observer .
```

Run container:

```bash
docker run --rm --env-file .env telegram-bot-observer
```
