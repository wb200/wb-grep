import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { Indexer } from "../lib/indexer";
import type { SearchResult } from "../lib/vector-store";

function formatResult(
  result: SearchResult,
  root: string,
  showContent: boolean,
): string {
  const relativePath = path.relative(root, result.filepath);
  const lineRange = `${result.lineStart}-${result.lineEnd}`;
  const score = (result.score * 100).toFixed(1);

  let output =
    chalk.cyan(`./${relativePath}`) +
    chalk.gray(`:${lineRange}`) +
    chalk.yellow(` (${score}%)`);

  if (showContent) {
    const lines = result.content.split("\n");
    const preview = lines.slice(0, 10).join("\n");
    const truncated =
      lines.length > 10 ? chalk.gray("\n  ... (truncated)") : "";
    output += `\n${chalk.gray(
      preview
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
    )}${truncated}`;
  }

  return output;
}

export async function performSearch(
  pattern: string,
  searchPath: string | undefined,
  options: {
    maxCount: number;
    content: boolean;
  },
): Promise<void> {
  const root = process.cwd();

  const config = loadConfig(root);
  const indexer = new Indexer({ config, root });

  const spinner = ora("Connecting to Ollama...").start();

  const { connected } = await indexer.checkOllama();
  if (!connected) {
    spinner.fail("Cannot connect to Ollama");
    console.log(chalk.yellow("\nMake sure Ollama is running:"));
    console.log(chalk.gray("  ollama serve\n"));
    console.log(chalk.yellow("And that you have indexed the repository:"));
    console.log(chalk.gray("  wb-grep watch\n"));
    process.exit(1);
  }

  spinner.text = "Initializing vector store...";
  await indexer.initialize();

  const stateManager = indexer.getStateManager();
  const stats = stateManager.getStats();

  if (stats.totalFiles === 0) {
    spinner.fail("No files indexed");
    console.log(chalk.yellow("\nPlease index the repository first:"));
    console.log(chalk.gray("  wb-grep watch\n"));
    process.exit(1);
  }

  spinner.text = "Generating query embedding...";
  const embedder = indexer.getEmbedder();
  const queryVector = await embedder.embed(pattern);

  spinner.text = "Searching...";

  let pathFilter: string | undefined;
  if (searchPath) {
    pathFilter = path.isAbsolute(searchPath)
      ? searchPath
      : path.join(root, searchPath);
  }

  const vectorStore = indexer.getVectorStore();
  const results = await vectorStore.search(
    queryVector,
    options.maxCount,
    pathFilter,
  );

  spinner.stop();

  if (results.length === 0) {
    console.log(chalk.yellow("\nNo results found.\n"));
    return;
  }

  console.log(chalk.blue(`\nFound ${results.length} result(s):\n`));

  for (const result of results) {
    console.log(formatResult(result, root, options.content));
    console.log();
  }
}

function parseBooleanEnv(
  envVar: string | undefined,
  defaultValue: boolean,
): boolean {
  if (envVar === undefined) return defaultValue;
  const lower = envVar.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "y";
}

export const search = new Command("search")
  .description("Search for patterns in the indexed codebase")
  .argument("<pattern>", "The search query (natural language)")
  .argument("[path]", "Optional path to search in")
  .option(
    "-m, --max-count <count>",
    "Maximum number of results",
    process.env.WBGREP_MAX_COUNT || "10",
  )
  .option(
    "-c, --content",
    "Show content snippets in results",
    parseBooleanEnv(process.env.WBGREP_CONTENT, false),
  )
  .allowUnknownOption(true)
  .action(async (pattern, searchPath, options) => {
    await performSearch(pattern, searchPath, {
      maxCount: Number.parseInt(options.maxCount, 10),
      content: options.content,
    });
  });
