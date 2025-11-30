import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { Indexer } from "../lib/indexer";

export async function performIndex(options: {
  clear: boolean;
  path?: string;
}): Promise<void> {
  const root = options.path ? path.resolve(options.path) : process.cwd();

  console.log(chalk.blue("\n🔄 Starting wb-grep index...\n"));

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

  if (options.clear) {
    spinner.text = "Clearing existing index...";
  }

  spinner.succeed("Vector store initialized");

  console.log(chalk.blue("\n📂 Scanning repository...\n"));

  const fileSystem = indexer.getFileSystem();
  const files = Array.from(fileSystem.getFiles(root));
  console.log(chalk.gray(`Found ${files.length} files to process\n`));

  const progressSpinner = ora(`Indexing 0/${files.length} files...`).start();

  // biome-ignore lint/complexity/useLiteralKeys: accessing private property for progress
  const originalOnProgress = indexer["onProgress"];
  // biome-ignore lint/complexity/useLiteralKeys: accessing private property for progress
  indexer["onProgress"] = (current, total, _file) => {
    progressSpinner.text = `Indexing ${current}/${total} files...`;
    originalOnProgress?.(current, total, _file);
  };

  const stats = await indexer.indexAll({ clear: options.clear });

  progressSpinner.succeed(
    `Indexed ${stats.indexed} files (${stats.skipped} skipped, ${stats.totalChunks} chunks total)`,
  );

  if (stats.failed > 0) {
    console.log(chalk.yellow(`  ${stats.failed} files failed to index`));
  }

  const indexStats = await indexer.getStats();
  console.log(chalk.blue("\n📊 Index Statistics:"));
  console.log(chalk.gray(`  Files: ${indexStats.vectorStats.uniqueFiles}`));
  console.log(chalk.gray(`  Chunks: ${indexStats.vectorStats.totalChunks}\n`));
}

export const indexCmd = new Command("index")
  .description("Index the codebase (one-shot, no watching)")
  .option("-c, --clear", "Clear existing index before indexing", false)
  .option("-p, --path <path>", "Path to index (defaults to current directory)")
  .action(async (options) => {
    await performIndex(options);
  });
