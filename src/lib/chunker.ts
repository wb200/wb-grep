import * as crypto from "node:crypto";
import * as path from "node:path";
import {
  DEFAULT_MAX_CHUNK_LINES,
  DEFAULT_MIN_CHUNK_LINES,
  DEFAULT_OVERLAP_LINES,
} from "./constants";

export interface CodeChunk {
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface ChunkConfig {
  maxChunkLines: number;
  overlapLines: number;
  minChunkLines: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  maxChunkLines: DEFAULT_MAX_CHUNK_LINES,
  overlapLines: DEFAULT_OVERLAP_LINES,
  minChunkLines: DEFAULT_MIN_CHUNK_LINES,
};

const FUNCTION_PATTERNS: Record<string, RegExp[]> = {
  ts: [
    /^\s*(export\s+)?(async\s+)?function\s+\w+/,
    /^\s*(export\s+)?class\s+\w+/,
    /^\s*(export\s+)?interface\s+\w+/,
    /^\s*(export\s+)?type\s+\w+\s*=/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
  ],
  tsx: [
    /^\s*(export\s+)?(async\s+)?function\s+\w+/,
    /^\s*(export\s+)?class\s+\w+/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*:\s*React\.FC/,
  ],
  js: [
    /^\s*(export\s+)?(async\s+)?function\s+\w+/,
    /^\s*(export\s+)?class\s+\w+/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
  ],
  jsx: [
    /^\s*(export\s+)?(async\s+)?function\s+\w+/,
    /^\s*(export\s+)?class\s+\w+/,
    /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
  ],
  py: [/^(async\s+)?def\s+\w+/, /^class\s+\w+/],
  java: [
    /^\s*(public|private|protected)?\s*(static\s+)?(final\s+)?[\w<>\[\]]+\s+\w+\s*\(/,
    /^\s*(public|private|protected)?\s*(abstract\s+)?class\s+\w+/,
  ],
  go: [/^func\s+(\([^)]+\)\s+)?\w+/, /^type\s+\w+\s+(struct|interface)/],
  rs: [
    /^\s*(pub\s+)?fn\s+\w+/,
    /^\s*(pub\s+)?struct\s+\w+/,
    /^\s*(pub\s+)?enum\s+\w+/,
    /^\s*(pub\s+)?impl\s+/,
  ],
  rb: [/^\s*def\s+\w+/, /^\s*class\s+\w+/],
  php: [
    /^\s*(public|private|protected)?\s*(static\s+)?function\s+\w+/,
    /^\s*class\s+\w+/,
  ],
  c: [/^[\w\s*]+\s+\w+\s*\([^)]*\)\s*\{?$/],
  cpp: [
    /^[\w\s*:]+\s+\w+\s*\([^)]*\)\s*(const)?\s*\{?$/,
    /^\s*class\s+\w+/,
    /^\s*struct\s+\w+/,
  ],
  h: [/^[\w\s*]+\s+\w+\s*\([^)]*\);?$/],
};

export class CodeChunker {
  private config: ChunkConfig;

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  chunkCode(content: string, filepath: string): CodeChunk[] {
    const lines = content.split("\n");

    if (lines.length <= this.config.maxChunkLines) {
      return [
        {
          content,
          lineStart: 1,
          lineEnd: lines.length,
        },
      ];
    }

    const ext = path.extname(filepath).slice(1).toLowerCase();
    const boundaries = this.detectBoundaries(lines, ext);

    if (boundaries.length > 1) {
      return this.chunkByBoundaries(lines, boundaries);
    }

    return this.chunkByLines(lines);
  }

  private detectBoundaries(lines: string[], ext: string): number[] {
    const boundaries: number[] = [0];
    const patterns = FUNCTION_PATTERNS[ext] || [];

    if (patterns.length === 0) {
      return boundaries;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some((pattern) => pattern.test(line))) {
        if (i > 0 && i !== boundaries[boundaries.length - 1]) {
          boundaries.push(i);
        }
      }
    }

    return boundaries;
  }

  private chunkByBoundaries(
    lines: string[],
    boundaries: number[],
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    boundaries.push(lines.length);

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const chunkLines = lines.slice(start, end);

      if (chunkLines.length > this.config.maxChunkLines) {
        chunks.push(...this.splitLargeChunk(chunkLines, start));
      } else if (chunkLines.length >= this.config.minChunkLines) {
        chunks.push({
          content: chunkLines.join("\n"),
          lineStart: start + 1,
          lineEnd: end,
        });
      }
    }

    if (chunks.length === 0 && lines.length > 0) {
      return this.chunkByLines(lines);
    }

    return chunks;
  }

  private chunkByLines(lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const step = this.config.maxChunkLines - this.config.overlapLines;

    for (let i = 0; i < lines.length; i += step) {
      const end = Math.min(i + this.config.maxChunkLines, lines.length);
      const chunkLines = lines.slice(i, end);

      if (chunkLines.length >= this.config.minChunkLines) {
        chunks.push({
          content: chunkLines.join("\n"),
          lineStart: i + 1,
          lineEnd: end,
        });
      }

      if (end === lines.length) break;
    }

    return chunks;
  }

  private splitLargeChunk(lines: string[], baseLineStart: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const step = this.config.maxChunkLines - this.config.overlapLines;

    for (let i = 0; i < lines.length; i += step) {
      const end = Math.min(i + this.config.maxChunkLines, lines.length);
      const chunkLines = lines.slice(i, end);

      if (chunkLines.length >= this.config.minChunkLines) {
        chunks.push({
          content: chunkLines.join("\n"),
          lineStart: baseLineStart + i + 1,
          lineEnd: baseLineStart + end,
        });
      }

      if (end === lines.length) break;
    }

    return chunks;
  }

  static computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
