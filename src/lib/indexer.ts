import * as fs from "node:fs";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { CodeChunker } from "./chunker";
import type { WbGrepConfig } from "./config";
import { BINARY_SAMPLE_SIZE, MAX_FILE_SIZE } from "./constants";
import { OllamaEmbedder } from "./embeddings";
import { FileSystem } from "./file";
import { IndexStateManager } from "./index-state";
import { type Logger, createLogger } from "./logger";
import type { SearchResult } from "./vector-store";
import { LanceDBStore } from "./vector-store";

export interface IndexResult {
  chunks: number;
  skipped: boolean;
  error?: string;
}

export interface IndexStats {
  indexed: number;
  skipped: number;
  failed: number;
  totalChunks: number;
}

export interface SearchOptions {
  limit?: number;
  pathFilter?: string;
}

export interface IndexerOptions {
  config: WbGrepConfig;
  root: string;
  logger?: Logger;
  onProgress?: (current: number, total: number, file: string) => void;
}

export class Indexer {
  private embedder: OllamaEmbedder;
  private vectorStore: LanceDBStore;
  private stateManager: IndexStateManager;
  private fileSystem: FileSystem;
  private chunker: CodeChunker;
  private config: WbGrepConfig;
  private root: string;
  private logger: Logger;
  private onProgress?: (current: number, total: number, file: string) => void;

  constructor(options: IndexerOptions) {
    this.config = options.config;
    this.root = options.root;
    this.logger = options.logger || createLogger();
    this.onProgress = options.onProgress;

    this.embedder = new OllamaEmbedder({
      baseURL: this.config.ollama.baseURL,
      model: this.config.ollama.model,
      timeout: this.config.ollama.timeout,
      retries: this.config.ollama.retries,
    });

    const wbGrepDir = path.join(this.root, ".wb-grep");
    this.vectorStore = new LanceDBStore(path.join(wbGrepDir, "vectors"));
    this.stateManager = new IndexStateManager(
      path.join(wbGrepDir, "state.json"),
    );
    this.fileSystem = new FileSystem({
      ignorePatterns: this.config.ignore,
    });
    this.chunker = new CodeChunker();
  }

  async checkOllama(): Promise<{ connected: boolean; hasModel: boolean }> {
    const connected = await this.embedder.ping();
    if (!connected) {
      return { connected: false, hasModel: false };
    }

    const hasModel = await this.embedder.checkModel();
    return { connected: true, hasModel };
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.stateManager.load();
  }

  async indexFile(filepath: string, force = false): Promise<IndexResult> {
    try {
      const stat = fs.statSync(filepath);
      const maxSize = this.config.indexing.maxFileSize || MAX_FILE_SIZE;

      if (stat.size > maxSize) {
        this.logger.debug(
          `Skipping ${filepath}: file too large (${stat.size} bytes)`,
        );
        return { chunks: 0, skipped: true };
      }

      if (stat.size === 0) {
        this.logger.debug(`Skipping ${filepath}: empty file`);
        return { chunks: 0, skipped: true };
      }

      const content = fs.readFileSync(filepath, "utf-8");

      if (this.isBinaryContent(content)) {
        this.logger.debug(`Skipping ${filepath}: binary content detected`);
        return { chunks: 0, skipped: true };
      }

      const hash = CodeChunker.computeHash(content);

      if (!force && !this.stateManager.hasFileChanged(filepath, hash)) {
        return { chunks: 0, skipped: true };
      }

      const existing = this.stateManager.getFile(filepath);
      if (existing) {
        await this.vectorStore.deleteByIds(existing.chunkIds);
      }

      const chunks = this.chunker.chunkCode(content, filepath);
      if (chunks.length === 0) {
        return { chunks: 0, skipped: true };
      }

      const embeddings = await this.embedder.batchEmbed(
        chunks.map((c) => c.content),
        this.config.indexing.concurrency,
      );

      const chunkIds: string[] = [];
      const records = chunks.map((chunk, idx) => {
        const id = uuidv4();
        chunkIds.push(id);
        return {
          id,
          filepath,
          content: chunk.content,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          vector: embeddings[idx],
          hash,
        };
      });

      await this.vectorStore.addChunks(records);

      this.stateManager.setFile(filepath, {
        hash,
        lastModified: Date.now(),
        chunkIds,
        chunkCount: chunks.length,
      });

      return { chunks: chunks.length, skipped: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to index ${filepath}: ${message}`);
      return { chunks: 0, skipped: true, error: message };
    }
  }

  async indexAll(options: { clear?: boolean } = {}): Promise<IndexStats> {
    if (options.clear) {
      await this.vectorStore.clear();
      this.stateManager.clear();
    }

    const files = Array.from(this.fileSystem.getFiles(this.root));
    const stats: IndexStats = {
      indexed: 0,
      skipped: 0,
      failed: 0,
      totalChunks: 0,
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.onProgress?.(i + 1, files.length, file);

      const result = await this.indexFile(file, options.clear);

      if (result.error) {
        stats.failed++;
      } else if (result.skipped) {
        stats.skipped++;
      } else {
        stats.indexed++;
        stats.totalChunks += result.chunks;
      }

      if ((i + 1) % this.config.indexing.batchSize === 0) {
        await this.stateManager.save();
      }
    }

    await this.stateManager.save();
    return stats;
  }

  async deleteFile(filepath: string): Promise<void> {
    const existing = this.stateManager.getFile(filepath);
    if (existing) {
      await this.vectorStore.deleteByIds(existing.chunkIds);
      this.stateManager.deleteFile(filepath);
      await this.stateManager.save();
    }
  }

  async save(): Promise<void> {
    await this.stateManager.save();
  }

  async getStats(): Promise<{
    files: number;
    chunks: number;
    lastSync: string;
    vectorStats: { totalChunks: number; uniqueFiles: number };
  }> {
    const stateStats = this.stateManager.getStats();
    const vectorStats = await this.vectorStore.getStats();

    return {
      files: stateStats.totalFiles,
      chunks: stateStats.totalChunks,
      lastSync: stateStats.lastSync,
      vectorStats,
    };
  }

  async clear(): Promise<void> {
    await this.vectorStore.clear();
    this.stateManager.clear();
    await this.stateManager.save();
  }

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? this.config.search.maxResults;
    const queryVector = await this.embedder.embed(query);
    return this.vectorStore.search(queryVector, limit, options.pathFilter);
  }

  setProgressCallback(
    callback: (current: number, total: number, file: string) => void,
  ): void {
    this.onProgress = callback;
  }

  getFileSystem(): FileSystem {
    return this.fileSystem;
  }

  getStateManager(): IndexStateManager {
    return this.stateManager;
  }

  private isBinaryContent(content: string): boolean {
    const sampleSize = Math.min(content.length, BINARY_SAMPLE_SIZE);
    const sample = content.slice(0, sampleSize);
    let nullCount = 0;

    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code === 0) {
        nullCount++;
        if (nullCount > 1) return true;
      }
    }

    return false;
  }
}
