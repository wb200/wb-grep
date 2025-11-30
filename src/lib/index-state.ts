import * as fs from "node:fs";
import * as path from "node:path";

export interface FileMetadata {
  hash: string;
  lastModified: number;
  chunkIds: string[];
  chunkCount: number;
}

export interface IndexStateData {
  version: string;
  lastSync: number;
  files: Record<string, FileMetadata>;
}

const STATE_VERSION = "1.0.0";

export class IndexStateManager {
  private statePath: string;
  private state: IndexStateData;
  private dirty = false;

  constructor(statePath: string) {
    this.statePath = statePath;
    this.state = {
      version: STATE_VERSION,
      lastSync: Date.now(),
      files: {},
    };
  }

  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, "utf-8");
        const parsed = JSON.parse(data) as IndexStateData;
        this.state = {
          version: parsed.version || STATE_VERSION,
          lastSync: parsed.lastSync || Date.now(),
          files: parsed.files || {},
        };
      }
    } catch {
      this.state = {
        version: STATE_VERSION,
        lastSync: Date.now(),
        files: {},
      };
    }
    this.dirty = false;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;

    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.state.lastSync = Date.now();
    fs.writeFileSync(
      this.statePath,
      JSON.stringify(this.state, null, 2),
      "utf-8",
    );
    this.dirty = false;
  }

  setFile(filepath: string, metadata: FileMetadata): void {
    this.state.files[filepath] = metadata;
    this.dirty = true;
  }

  getFile(filepath: string): FileMetadata | undefined {
    return this.state.files[filepath];
  }

  deleteFile(filepath: string): void {
    if (this.state.files[filepath]) {
      delete this.state.files[filepath];
      this.dirty = true;
    }
  }

  hasFileChanged(filepath: string, hash: string): boolean {
    const existing = this.state.files[filepath];
    return !existing || existing.hash !== hash;
  }

  getAllFiles(): string[] {
    return Object.keys(this.state.files);
  }

  getStats(): {
    totalFiles: number;
    totalChunks: number;
    lastSync: string;
  } {
    const files = Object.values(this.state.files);
    return {
      totalFiles: files.length,
      totalChunks: files.reduce((sum, f) => sum + f.chunkCount, 0),
      lastSync: new Date(this.state.lastSync).toISOString(),
    };
  }

  clear(): void {
    this.state.files = {};
    this.dirty = true;
  }
}
