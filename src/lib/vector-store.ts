import * as fs from "node:fs";
import * as path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { VECTOR_DIMENSIONS } from "./constants";

export interface ChunkRecord {
  id: string;
  filepath: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  vector: number[];
  hash: string;
  timestamp: number;
}

interface LanceDBRow extends ChunkRecord {
  _distance?: number;
}

export interface SearchResult {
  id: string;
  filepath: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  score: number;
}

const TABLE_NAME = "code_chunks";

export class LanceDBStore {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = await lancedb.connect(this.storePath);

    const tableNames = await this.db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      this.table = await this.db.openTable(TABLE_NAME);
    } else {
      const schema = [
        {
          id: "init",
          filepath: "",
          content: "",
          lineStart: 0,
          lineEnd: 0,
          vector: Array(VECTOR_DIMENSIONS).fill(0),
          hash: "",
          timestamp: 0,
        },
      ];
      this.table = await this.db.createTable(TABLE_NAME, schema);
      await this.table.delete('id = "init"');
    }
  }

  async addChunks(chunks: Omit<ChunkRecord, "timestamp">[]): Promise<void> {
    if (!this.table || chunks.length === 0) return;

    const now = Date.now();
    const records = chunks.map((chunk) => ({
      ...chunk,
      timestamp: now,
    }));

    await this.table.add(records);
  }

  async deleteByFilepath(filepath: string): Promise<void> {
    if (!this.table) return;
    await this.table.delete(`filepath = '${filepath.replace(/'/g, "''")}'`);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (!this.table || ids.length === 0) return;
    const idList = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
    await this.table.delete(`id IN (${idList})`);
  }

  private escapeSqlString(value: string): string {
    const result = value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "''")
      .replace(/"/g, '\\"');

    // Remove null bytes and control characters (codes 0-31 and 127)
    let sanitized = "";
    for (let i = 0; i < result.length; i++) {
      const code = result.charCodeAt(i);
      if (code >= 32 && code !== 127) {
        sanitized += result[i];
      }
    }
    return sanitized;
  }

  async search(
    queryVector: number[],
    limit = 10,
    pathFilter?: string,
  ): Promise<SearchResult[]> {
    if (!this.table) return [];

    let query = this.table.vectorSearch(queryVector).limit(limit);

    if (pathFilter) {
      const escapedPath = this.escapeSqlString(pathFilter);
      query = query.where(`filepath LIKE '${escapedPath}%'`);
    }

    const results = (await query.toArray()) as LanceDBRow[];

    return results.map((row) => ({
      id: row.id,
      filepath: row.filepath,
      content: row.content,
      lineStart: row.lineStart,
      lineEnd: row.lineEnd,
      score: row._distance != null ? 1 / (1 + row._distance) : 0,
    }));
  }

  async getChunksByFilepath(filepath: string): Promise<ChunkRecord[]> {
    if (!this.table) return [];
    const escapedPath = filepath.replace(/'/g, "''");
    const results = await this.table
      .query()
      .where(`filepath = '${escapedPath}'`)
      .toArray();
    return results as ChunkRecord[];
  }

  async count(): Promise<number> {
    if (!this.table) return 0;
    return await this.table.countRows();
  }

  async getStats(): Promise<{
    totalChunks: number;
    uniqueFiles: number;
  }> {
    if (!this.table) return { totalChunks: 0, uniqueFiles: 0 };

    const totalChunks = await this.table.countRows();
    const filepathRows = (await this.table
      .query()
      .select(["filepath"])
      .toArray()) as Array<{ filepath: string }>;
    const uniqueFiles = new Set(filepathRows.map((r) => r.filepath)).size;

    return { totalChunks, uniqueFiles };
  }

  async clear(): Promise<void> {
    if (!this.table) return;
    await this.table.delete("id IS NOT NULL");
  }

  async close(): Promise<void> {
    this.table = null;
    this.db = null;
  }
}
