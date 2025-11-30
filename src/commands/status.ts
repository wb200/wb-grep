import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { Indexer } from "../lib/indexer";

export async function performStatus(options: {
  verbose: boolean;
}): Promise<void> {
  const root = process.cwd();
  const wbGrepDir = path.join(root, ".wb-grep");

  console.log(chalk.blue("\n📊 wb-grep Status\n"));

  if (!fs.existsSync(wbGrepDir)) {
    console.log(chalk.yellow("No index found in this directory."));
    console.log(
      chalk.gray(
        "\nRun 'wb-grep index' or 'wb-grep watch' to create an index.\n",
      ),
    );
    return;
  }

  const config = loadConfig(root);
  const spinner = ora("Loading index state...").start();

  const indexer = new Indexer({ config, root });

  try {
    await indexer.initialize();
    spinner.stop();

    const stats = await indexer.getStats();

    console.log(chalk.white("Index Statistics:"));
    console.log(chalk.gray(`  Files indexed:    ${stats.files}`));
    console.log(chalk.gray(`  Total chunks:     ${stats.chunks}`));
    console.log(chalk.gray(`  Last sync:        ${stats.lastSync}`));

    console.log(chalk.white("\nVector Store:"));
    console.log(
      chalk.gray(`  Unique files:     ${stats.vectorStats.uniqueFiles}`),
    );
    console.log(
      chalk.gray(`  Total vectors:    ${stats.vectorStats.totalChunks}`),
    );

    const { connected, hasModel } = await indexer.checkOllama();

    console.log(chalk.white("\nOllama Status:"));
    console.log(
      chalk.gray(
        `  Connected:        ${connected ? chalk.green("yes") : chalk.red("no")}`,
      ),
    );
    console.log(
      chalk.gray(
        `  Model available:  ${hasModel ? chalk.green("yes") : chalk.red("no")}`,
      ),
    );
    console.log(chalk.gray(`  Model:            ${config.ollama.model}`));
    console.log(chalk.gray(`  URL:              ${config.ollama.baseURL}`));

    if (options.verbose) {
      console.log(chalk.white("\nConfiguration:"));
      console.log(chalk.gray(`  Timeout:          ${config.ollama.timeout}ms`));
      console.log(chalk.gray(`  Retries:          ${config.ollama.retries}`));
      console.log(
        chalk.gray(`  Batch size:       ${config.indexing.batchSize}`),
      );
      console.log(
        chalk.gray(`  Concurrency:      ${config.indexing.concurrency}`),
      );
      console.log(
        chalk.gray(
          `  Max file size:    ${(config.indexing.maxFileSize / 1024).toFixed(0)}KB`,
        ),
      );

      const stateManager = indexer.getStateManager();
      const files = stateManager.getAllFiles();

      if (files.length > 0) {
        console.log(chalk.white("\nIndexed Files:"));
        const displayFiles = files.slice(0, 20);
        for (const file of displayFiles) {
          const relativePath = path.relative(root, file);
          const metadata = stateManager.getFile(file);
          console.log(
            chalk.gray(
              `  ${relativePath} (${metadata?.chunkCount ?? 0} chunks)`,
            ),
          );
        }
        if (files.length > 20) {
          console.log(chalk.gray(`  ... and ${files.length - 20} more files`));
        }
      }
    }

    console.log();
  } catch (error) {
    spinner.fail("Failed to load index state");
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(chalk.red(`Error: ${message}\n`));
    process.exit(1);
  }
}

export const status = new Command("status")
  .description("Show index status and statistics")
  .option(
    "-v, --verbose",
    "Show detailed information including file list",
    false,
  )
  .action(async (options) => {
    await performStatus(options);
  });
