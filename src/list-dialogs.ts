import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { loadClientConfig } from "./config";

function getUsername(entity: unknown): string {
  if (entity instanceof Api.User || entity instanceof Api.Channel) {
    return entity.username ? `@${entity.username}` : "-";
  }
  return "-";
}

function getDialogType(dialog: {
  isUser: boolean;
  isGroup: boolean;
  isChannel: boolean;
}): string {
  if (dialog.isUser) {
    return "user";
  }
  if (dialog.isGroup) {
    return "group";
  }
  if (dialog.isChannel) {
    return "channel";
  }
  return "unknown";
}

async function main(): Promise<void> {
  const config = loadClientConfig();
  const client = new TelegramClient(
    new StringSession(config.sessionString),
    config.apiId,
    config.apiHash,
    { connectionRetries: 5 }
  );

  await client.connect();
  try {
    const isAuthorized = await client.checkAuthorization();
    if (!isAuthorized) {
      throw new Error(
        "Session is not authorized. Run: npm run session:init"
      );
    }

    console.log("id\ttype\ttitle\tusername");
    for await (const dialog of client.iterDialogs({})) {
      const dialogId = dialog.id?.toString();
      if (!dialogId) {
        continue;
      }

      const title = dialog.title ?? dialog.name ?? "(no title)";
      const username = getUsername(dialog.entity);
      const type = getDialogType(dialog);
      console.log(`${dialogId}\t${type}\t${title}\t${username}`);
    }
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

