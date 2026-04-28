import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { loadApiConfig } from "./config";

const ENV_PATH = resolve(process.cwd(), ".env");

async function upsertSessionString(sessionString: string): Promise<void> {
  let envContent = "";
  try {
    envContent = await readFile(ENV_PATH, "utf8");
  } catch (error: unknown) {
    if (!(error instanceof Error) || "code" in error === false) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const sessionLine = `SESSION_STRING=${sessionString}`;
  if (/^SESSION_STRING=.*$/m.test(envContent)) {
    envContent = envContent.replace(/^SESSION_STRING=.*$/m, sessionLine);
  } else {
    if (envContent.length > 0 && !envContent.endsWith("\n")) {
      envContent += "\n";
    }
    envContent += `${sessionLine}\n`;
  }

  await writeFile(ENV_PATH, envContent, "utf8");
}

async function main(): Promise<void> {
  const { apiId, apiHash } = loadApiConfig();
  const rl = createInterface({ input, output });
  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => rl.question("Phone number (+...): "),
      phoneCode: async () => rl.question("Code from Telegram: "),
      password: async (hint) => {
        const prompt = hint ? `2FA password (${hint}): ` : "2FA password: ";
        return rl.question(prompt);
      },
      onError: (err) => {
        console.error("Auth error:", err.message);
      },
    });

    const sessionString = stringSession.save();
    await upsertSessionString(sessionString);

    console.log("\nSession created.");
    console.log(`Saved SESSION_STRING to ${ENV_PATH}`);
  } finally {
    rl.close();
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
