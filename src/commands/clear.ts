import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { Indexer } from "../lib/indexer";

export async function performClear(options: { force: boolean }): Promise<void> {
  const root = process.cwd();
  const wbGrepDir = path.join(root, ".wb-grep");

  if (!fs.existsSync(wbGrepDir)) {
    console.log(chalk.yellow("\nNo index found in this directory.\n"));
    return;
  }

  if (!options.force) {
    console.log(chalk.yellow("\n⚠️  This will delete the entire index.\n"));
    console.log(chalk.gray("Use --force to confirm deletion.\n"));
    return;
  }

  const config = loadConfig(root);
  const spinner = ora("Clearing index...").start();

  const indexer = new Indexer({ config, root });

  try {
    await indexer.initialize();
    await indexer.clear();
    spinner.succeed("Index cleared");

    console.log(chalk.green("\n✓ Successfully cleared all indexed data.\n"));
    console.log(
      chalk.gray(
        "Run 'wb-grep index' or 'wb-grep watch' to rebuild the index.\n",
      ),
    );
  } catch (error) {
    spinner.fail("Failed to clear index");
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(chalk.red(`Error: ${message}\n`));
    process.exit(1);
  }
}

export const clear = new Command("clear")
  .description("Clear the index and remove all indexed data")
  .option("-f, --force", "Force clear without confirmation", false)
  .action(async (options) => {
    await performClear(options);
  });
