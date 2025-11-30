import * as path from "node:path";
import { CodeChunker } from "./chunker";
import { OllamaEmbedder } from "./embeddings";
import { FileSystem, type FileSystemOptions } from "./file";
import { IndexStateManager } from "./index-state";
import { LanceDBStore } from "./vector-store";

const WB_GREP_DIR = ".wb-grep";

export interface WbGrepConfig {
  storePath: string;
  statePath: string;
  ollamaBaseURL: string;
  ollamaModel: string;
}

function getDefaultConfig(root: string): WbGrepConfig {
  const wbGrepDir = path.join(root, WB_GREP_DIR);
  return {
    storePath: path.join(wbGrepDir, "vectors"),
    statePath: path.join(wbGrepDir, "state.json"),
    ollamaBaseURL: process.env.WBGREP_OLLAMA_URL || "http://localhost:11434",
    ollamaModel: process.env.WBGREP_OLLAMA_MODEL || "qwen3-embedding:0.6b",
  };
}

export function createEmbedder(config?: Partial<WbGrepConfig>): OllamaEmbedder {
  const defaultConfig = getDefaultConfig(process.cwd());
  return new OllamaEmbedder({
    baseURL: config?.ollamaBaseURL || defaultConfig.ollamaBaseURL,
    model: config?.ollamaModel || defaultConfig.ollamaModel,
  });
}

export function createVectorStore(root: string): LanceDBStore {
  const config = getDefaultConfig(root);
  return new LanceDBStore(config.storePath);
}

export function createStateManager(root: string): IndexStateManager {
  const config = getDefaultConfig(root);
  return new IndexStateManager(config.statePath);
}

export function createFileSystem(options?: FileSystemOptions): FileSystem {
  return new FileSystem(options);
}

export function createChunker(): CodeChunker {
  return new CodeChunker();
}

export function getWbGrepDir(root: string): string {
  return path.join(root, WB_GREP_DIR);
}

export function getConfig(root: string): WbGrepConfig {
  return getDefaultConfig(root);
}
