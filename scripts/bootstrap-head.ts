import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createDatabase } from "../src/db/connection";
import { parseServerEnv } from "../src/lib/env-schema";
import { bootstrapHead } from "../src/lib/users/bootstrap";
import { requireBootstrapDatabase } from "./database-env";

async function getCredentials() {
  let name = process.env.KIG_BOOTSTRAP_HEAD_NAME;
  let email = process.env.KIG_BOOTSTRAP_HEAD_EMAIL;
  let password = process.env.KIG_BOOTSTRAP_HEAD_PASSWORD;

  if ((!name || !email || !password) && stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      if (!name) {
        name = await rl.question("Initial HEAD full name: ");
      }
      if (!email) {
        email = await rl.question("Initial HEAD email address: ");
      }
      if (!password) {
        stdout.write("Initial HEAD password (hidden): ");
        stdin.setRawMode?.(true);
        stdin.resume();
        password = "";
        await new Promise<void>((resolve) => {
          const onData = (chunk: Buffer) => {
            const str = chunk.toString("utf8");
            for (const char of str) {
              if (char === "\r" || char === "\n" || char === "\u0004") {
                stdin.removeListener("data", onData);
                stdin.setRawMode?.(false);
                stdout.write("\n");
                resolve();
                return;
              } else if (char === "\u0003") {
                process.exit(1);
              } else if (char === "\b" || char === "\x7f") {
                if (password && password.length > 0) {
                  password = password.slice(0, -1);
                }
              } else {
                password += char;
              }
            }
          };
          stdin.on("data", onData);
        });
      }
    } finally {
      rl.close();
    }
  }

  return {
    name: name?.trim(),
    email: email?.trim(),
    password: password?.trim(),
  };
}

async function main() {
  const url = requireBootstrapDatabase();
  const credentials = await getCredentials();
  const db = createDatabase(url);
  try {
    await bootstrapHead(db, parseServerEnv(process.env), credentials);
    console.log(
      "Initial HEAD created with audited bootstrap evidence. Credentials withheld.",
    );
  } finally {
    await db.$client.end();
  }
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(
    `Bootstrap refused or failed: ${message}. Privately verify authorization, required inputs, password policy, duplicate identity and existing ACTIVE HEAD. No credentials printed.`,
  );
  process.exitCode = 1;
});
