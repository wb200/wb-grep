import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RESULTS,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_RETRIES,
  DEFAULT_OLLAMA_TIMEOUT,
  DEFAULT_OLLAMA_URL,
  MAX_FILE_SIZE,
} from "./constants";

export interface WbGrepConfig {
  ollama: {
    baseURL: string;
    model: string;
    timeout: number;
    retries: number;
  };
  indexing: {
    batchSize: number;
    maxFileSize: number;
    concurrency: number;
  };
  search: {
    maxResults: number;
    showContent: boolean;
  };
  ignore: string[];
}

const DEFAULT_CONFIG: WbGrepConfig = {
  ollama: {
    baseURL: DEFAULT_OLLAMA_URL,
    model: DEFAULT_OLLAMA_MODEL,
    timeout: DEFAULT_OLLAMA_TIMEOUT,
    retries: DEFAULT_OLLAMA_RETRIES,
  },
  indexing: {
    batchSize: DEFAULT_BATCH_SIZE,
    maxFileSize: MAX_FILE_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
  },
  search: {
    maxResults: DEFAULT_MAX_RESULTS,
    showContent: false,
  },
  ignore: [],
};

const CONFIG_FILES = [".wbgreprc", ".wbgreprc.json", "wbgrep.config.json"];

function deepMerge(
  target: WbGrepConfig,
  source: Partial<WbGrepConfig>,
): WbGrepConfig {
  const result = { ...target };

  if (source.ollama) {
    result.ollama = { ...result.ollama, ...source.ollama };
  }
  if (source.indexing) {
    result.indexing = { ...result.indexing, ...source.indexing };
  }
  if (source.search) {
    result.search = { ...result.search, ...source.search };
  }
  if (source.ignore) {
    result.ignore = [...result.ignore, ...source.ignore];
  }

  return result;
}

function findConfigFile(root: string): string | null {
  for (const filename of CONFIG_FILES) {
    const filepath = path.join(root, filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
  }
  return null;
}

function loadConfigFile(filepath: string): Partial<WbGrepConfig> {
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(content) as Partial<WbGrepConfig>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to parse config file ${filepath}: ${message}`);
  }
}

function applyEnvOverrides(config: WbGrepConfig): WbGrepConfig {
  const result = { ...config };

  if (process.env.WBGREP_OLLAMA_URL) {
    result.ollama = {
      ...result.ollama,
      baseURL: process.env.WBGREP_OLLAMA_URL,
    };
  }
  if (process.env.WBGREP_OLLAMA_MODEL) {
    result.ollama = {
      ...result.ollama,
      model: process.env.WBGREP_OLLAMA_MODEL,
    };
  }
  if (process.env.WBGREP_OLLAMA_TIMEOUT) {
    result.ollama = {
      ...result.ollama,
      timeout: Number.parseInt(process.env.WBGREP_OLLAMA_TIMEOUT, 10),
    };
  }
  if (process.env.WBGREP_OLLAMA_RETRIES) {
    result.ollama = {
      ...result.ollama,
      retries: Number.parseInt(process.env.WBGREP_OLLAMA_RETRIES, 10),
    };
  }
  if (process.env.WBGREP_MAX_COUNT) {
    result.search = {
      ...result.search,
      maxResults: Number.parseInt(process.env.WBGREP_MAX_COUNT, 10),
    };
  }
  if (process.env.WBGREP_CONTENT) {
    result.search = {
      ...result.search,
      showContent: process.env.WBGREP_CONTENT.toLowerCase() === "true",
    };
  }
  if (process.env.WBGREP_BATCH_SIZE) {
    result.indexing = {
      ...result.indexing,
      batchSize: Number.parseInt(process.env.WBGREP_BATCH_SIZE, 10),
    };
  }
  if (process.env.WBGREP_CONCURRENCY) {
    result.indexing = {
      ...result.indexing,
      concurrency: Number.parseInt(process.env.WBGREP_CONCURRENCY, 10),
    };
  }

  return result;
}

export function loadConfig(root: string): WbGrepConfig {
  let config = { ...DEFAULT_CONFIG };

  const configFile = findConfigFile(root);
  if (configFile) {
    const fileConfig = loadConfigFile(configFile);
    config = deepMerge(config, fileConfig);
  }

  config = applyEnvOverrides(config);

  return config;
}

export function getDefaultConfig(): WbGrepConfig {
  return { ...DEFAULT_CONFIG };
}
