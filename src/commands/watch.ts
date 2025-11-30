import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import chokidar from "chokidar";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { WATCH_DEBOUNCE_MS, WB_GREP_DIR } from "../lib/constants";
import { Indexer } from "../lib/indexer";

export async function startWatch(options: { dryRun: boolean }): Promise<void> {
  const root = process.cwd();
  const wbGrepDir = path.join(root, WB_GREP_DIR);

  console.log(chalk.blue("\n🚀 Starting wb-grep watch...\n"));

  const config = loadConfig(root);
  const indexer = new Indexer({ config, root });

  const spinner = ora("Checking Ollama connection...").start();

  const { connected, hasModel } = await indexer.checkOllama();

  if (!connected) {
    spinner.fail("Cannot connect to Ollama");
    console.log(chalk.yellow("\nMake sure Ollama is running:"));
    console.log(chalk.gray("  ollama serve\n"));
    process.exit(1);
  }
  spinner.succeed("Ollama is running");

  if (!hasModel) {
    spinner.fail("Model not found");
    console.log(chalk.yellow("\nPlease pull the model first:"));
    console.log(chalk.gray(`  ollama pull ${config.ollama.model}\n`));
    process.exit(1);
  }
  spinner.text = "Model is ready";
  spinner.succeed();

  spinner.start("Initializing vector store...");
  await indexer.initialize();
  spinner.succeed("Vector store initialized");

  console.log(chalk.blue("\n📂 Scanning repository...\n"));

  const fileSystem = indexer.getFileSystem();
  const files = Array.from(fileSystem.getFiles(root));
  console.log(chalk.gray(`Found ${files.length} files to process\n`));

  if (options.dryRun) {
    console.log(chalk.yellow("Dry run mode - no files will be indexed\n"));
    for (const file of files) {
      const relativePath = path.relative(root, file);
      console.log(chalk.gray(`  Would index: ${relativePath}`));
    }
    console.log(chalk.green(`\n✓ Would index ${files.length} files\n`));
    return;
  }

  const progressSpinner = ora(`Indexing 0/${files.length} files...`).start();

  const stats = await indexer.indexAll();

  progressSpinner.succeed(
    `Indexed ${stats.indexed} files (${stats.skipped} unchanged, ${stats.totalChunks} chunks)`,
  );

  if (stats.failed > 0) {
    console.log(chalk.yellow(`  ${stats.failed} files failed to index`));
  }

  console.log(chalk.blue("\n👁️  Watching for changes... (Ctrl+C to stop)\n"));

  const watcher = chokidar.watch(root, {
    ignored: [
      /(^|[/\\])\../,
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      `**/${path.basename(wbGrepDir)}/**`,
    ],
    persistent: true,
    ignoreInitial: true,
  });

  let debounceTimer: NodeJS.Timeout | null = null;
  const pendingChanges = new Set<string>();

  const processPendingChanges = async () => {
    if (pendingChanges.size === 0) return;

    const changedFiles = Array.from(pendingChanges);
    pendingChanges.clear();

    for (const file of changedFiles) {
      if (!fs.existsSync(file)) continue;
      if (fileSystem.isIgnored(file, root)) continue;

      const stat = fs.statSync(file);
      if (!stat.isFile()) continue;

      const relativePath = path.relative(root, file);
      const result = await indexer.indexFile(file);

      if (!result.skipped) {
        console.log(
          chalk.green(`✓ Updated ${relativePath} (${result.chunks} chunks)`),
        );
      }
    }

    await indexer.save();
  };

  const scheduleUpdate = (filepath: string) => {
    pendingChanges.add(filepath);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processPendingChanges, WATCH_DEBOUNCE_MS);
  };

  watcher.on("add", scheduleUpdate);
  watcher.on("change", scheduleUpdate);

  watcher.on("unlink", async (filepath) => {
    const relativePath = path.relative(root, filepath);
    await indexer.deleteFile(filepath);
    console.log(chalk.yellow(`🗑️  Removed ${relativePath}`));
  });

  process.on("SIGINT", async () => {
    console.log(chalk.blue("\n\n👋 Stopping watch...\n"));
    await watcher.close();
    await indexer.save();
    process.exit(0);
  });
}

export const watch = new Command("watch")
  .description("Watch for file changes and keep the index up-to-date")
  .option(
    "-d, --dry-run",
    "Show what would be indexed without actually indexing",
    false,
  )
  .action(async (options) => {
    await startWatch(options);
  });
