import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config";
import { Indexer } from "../lib/indexer";

async function copyRecursive(
  source: string,
  destination: string,
): Promise<void> {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const files = fs.readdirSync(source);

  for (const file of files) {
    const srcPath = path.join(source, file);
    const destPath = path.join(destination, file);

    if (fs.statSync(srcPath).isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function checkOllamaConnection(
  baseURL: string,
): Promise<{ connected: boolean; modelAvailable: boolean }> {
  try {
    const response = await fetch(`${baseURL}/api/tags`);
    if (!response.ok) {
      return { connected: false, modelAvailable: false };
    }

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models || [];
    const hasModel = models.some((m) =>
      m.name.includes("qwen3-embedding") || m.name.includes("qwen3"),
    );

    return { connected: true, modelAvailable: hasModel };
  } catch {
    return { connected: false, modelAvailable: false };
  }
}

async function getFactoryPluginDir(): Promise<string> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".factory", "plugins", "wb-grep");
}

export async function performInstallDroid(options: {
  verify?: boolean;
  force?: boolean;
}): Promise<void> {
  const spinner = ora();
  const root = process.cwd();
  const config = loadConfig(root);

  try {
    // Step 1: Check Ollama connection
    spinner.start("Checking Ollama connectivity...");
    const { connected, modelAvailable } = await checkOllamaConnection(
      config.ollama.baseURL,
    );

    if (!connected) {
      spinner.fail("Cannot connect to Ollama");
      console.log(chalk.yellow("\nMake sure Ollama is running:"));
      console.log(chalk.gray("  ollama serve\n"));
      process.exit(1);
    }

    spinner.succeed("Ollama connected");

    // Step 2: Check embedding model
    spinner.start("Checking embedding model...");
    if (!modelAvailable) {
      spinner.warn("Embedding model not found");
      console.log(chalk.yellow("\nPull the Qwen3 embedding model:"));
      console.log(chalk.gray("  ollama pull qwen3-embedding:0.6b\n"));
      process.exit(1);
    }

    spinner.succeed("Embedding model available");

    // Step 3: Check index status
    spinner.start("Checking index status...");
    const indexer = new Indexer({ config, root });
    await indexer.initialize();
    const stateManager = indexer.getStateManager();
    const stats = stateManager.getStats();

    if (stats.totalFiles === 0) {
      spinner.warn("Repository not yet indexed");
      console.log(chalk.yellow("\nIndex the repository:"));
      console.log(chalk.gray("  wb-grep watch\n"));
    } else {
      spinner.succeed(
        `Index ready (${stats.totalFiles} files, ${stats.totalChunks} chunks)`,
      );
    }

    // Step 4: Install plugin
    if (options.verify) {
      spinner.start("Verifying plugin installation...");
    } else {
      spinner.start("Installing wb-grep plugin for Droid...");
    }

    const pluginDir = await getFactoryPluginDir();
    const pluginSourceDir = path.join(
      path.dirname(path.dirname(__dirname)),
      "plugins",
      "wb-grep",
    );

    if (!fs.existsSync(pluginSourceDir)) {
      spinner.fail("Plugin source files not found");
      console.log(chalk.red(`Expected at: ${pluginSourceDir}`));
      process.exit(1);
    }

    if (fs.existsSync(pluginDir) && !options.force) {
      if (options.verify) {
        spinner.succeed("Plugin already installed");
      } else {
        spinner.warn("Plugin already installed");
        console.log(chalk.yellow("Use --force to reinstall"));
      }
    } else {
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
      await copyRecursive(pluginSourceDir, pluginDir);
      spinner.succeed("Plugin installed");
    }

    // Step 5: Check advanced-grep skill
    spinner.start("Checking advanced-grep skill...");
    const skillsDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".factory",
      "skills",
      "advanced-grep",
    );

    if (fs.existsSync(skillsDir)) {
      spinner.succeed("advanced-grep skill found");
    } else {
      spinner.warn("advanced-grep skill not found");
      console.log(chalk.yellow("\nThe advanced-grep skill provides decision"));
      console.log(chalk.yellow("guidance for optimal search strategy."));
    }

    // Step 6: Success message
    console.log(chalk.green("\n✓ wb-grep is ready for use with Droid!\n"));

    console.log(chalk.blue("Plugin Structure:"));
    console.log(chalk.gray(`  ${pluginDir}/`));
    console.log(chalk.gray("  ├── hooks/"));
    console.log(chalk.gray("  │   ├── hook.json"));
    console.log(chalk.gray("  │   ├── wb_grep_watch.py"));
    console.log(chalk.gray("  │   └── wb_grep_watch_kill.py"));
    console.log(chalk.gray("  ├── skills/"));
    console.log(chalk.gray("  │   └── wb-grep/"));
    console.log(chalk.gray("  │       └── SKILL.md"));
    console.log(chalk.gray("  └── plugin.json\n"));

    console.log(chalk.blue("Next Steps:"));
    console.log(
      chalk.gray("  1. Keep 'wb-grep watch' running in another terminal"),
    );
    console.log(chalk.gray("  2. Start a Droid session in your project"));
    console.log(chalk.gray("     droid"));
    console.log(
      chalk.gray("  3. Use semantic search directly or via skills\n"),
    );

    console.log(chalk.blue("Usage:"));
    console.log(chalk.gray("  # Direct search"));
    console.log(chalk.gray("  wb-grep \"authentication logic\"\n"));

    console.log(chalk.gray("  # Within Droid, use the advanced-grep skill:"));
    console.log(chalk.gray("  droid> Where is error handling?\n"));

    console.log(chalk.yellow("Pro Tips:"));
    console.log(
      chalk.gray(
        "  • Use natural language: 'where is X handled?', not just 'X'",
      ),
    );
    console.log(
      chalk.gray("  • Combine with paths: wb-grep 'auth' src/security"),
    );
    console.log(chalk.gray("  • Show snippets: wb-grep -c 'pattern'\n"));
  } catch (error) {
    spinner.fail("Installation failed");
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}

export const installDroid = new Command("install-droid")
  .description("Set up wb-grep for use with Factory Droid")
  .option(
    "--verify",
    "Verify existing installation without making changes",
  )
  .option("--force", "Force reinstallation of plugin")
  .action(async (options: { verify?: boolean; force?: boolean }) => {
    await performInstallDroid(options);
  });
