#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { program } from "commander";
import { clear } from "./commands/clear";
import { indexCmd } from "./commands/index-cmd";
import { search } from "./commands/search";
import { status } from "./commands/status";
import { watch } from "./commands/watch";
import { installDroid } from "./commands/install-droid";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), {
    encoding: "utf-8",
  }),
);

program
  .name("wb-grep")
  .version(packageJson.version)
  .description(
    "A local semantic grep tool using Qwen3 embeddings via Ollama and LanceDB",
  );

program.addCommand(search, { isDefault: true });
program.addCommand(watch);
program.addCommand(indexCmd);
program.addCommand(status);
program.addCommand(clear);
program.addCommand(installDroid);

program.parse();
