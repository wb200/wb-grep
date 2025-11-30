import * as fs from "node:fs";
import * as path from "node:path";
import ignore, { type Ignore } from "ignore";

export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  "*.lock",
  "*.bin",
  "*.ipynb",
  "*.pyc",
  "*.safetensors",
  "*.sqlite",
  "*.pt",
  "*.whl",
  "*.egg",
  "*.so",
  "*.dll",
  "*.dylib",
  "*.exe",
  "*.o",
  "*.a",
  "*.class",
  "*.jar",
  "*.war",
  "*.min.js",
  "*.min.css",
  "*.map",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

export const CODE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".r",
  ".m",
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".vue",
  ".svelte",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".bat",
  ".cmd",
  ".dockerfile",
  ".makefile",
  ".cmake",
  ".gradle",
  ".tf",
  ".hcl",
  ".proto",
  ".graphql",
  ".prisma",
];

export interface FileSystemOptions {
  ignorePatterns?: string[];
}

export class FileSystem {
  private customIgnore: Ignore;
  private ignoreCache = new Map<string, Ignore>();

  constructor(options: FileSystemOptions = {}) {
    this.customIgnore = ignore();
    this.customIgnore.add([
      ...DEFAULT_IGNORE_PATTERNS,
      ...(options.ignorePatterns || []),
    ]);
  }

  *getFiles(dirRoot: string): Generator<string> {
    this.loadIgnoreFiles(dirRoot);
    yield* this.scanDirectory(dirRoot, dirRoot);
  }

  private *scanDirectory(dir: string, root: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (this.isHidden(entry.name)) continue;
      if (this.isIgnored(fullPath, root)) continue;

      if (entry.isDirectory()) {
        yield* this.scanDirectory(fullPath, root);
      } else if (entry.isFile() && this.isCodeFile(fullPath)) {
        yield fullPath;
      }
    }
  }

  private isHidden(name: string): boolean {
    return name.startsWith(".") && name !== "." && name !== "..";
  }

  isIgnored(filePath: string, root: string): boolean {
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");

    if (this.customIgnore.ignores(relativePath)) {
      return true;
    }

    let currentDir = path.dirname(filePath);
    const absoluteRoot = path.resolve(root);

    while (true) {
      const ig = this.getDirectoryIgnore(currentDir);
      if (ig) {
        const relativeToDir = path
          .relative(currentDir, filePath)
          .replace(/\\/g, "/");
        if (relativeToDir && ig.ignores(relativeToDir)) {
          return true;
        }
      }

      if (path.resolve(currentDir) === absoluteRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }

    return false;
  }

  private isCodeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    if (CODE_EXTENSIONS.includes(ext)) return true;

    const specialFiles = [
      "dockerfile",
      "makefile",
      "cmakelists.txt",
      "gemfile",
      "rakefile",
    ];
    return specialFiles.includes(basename);
  }

  private loadIgnoreFiles(root: string): void {
    this.getDirectoryIgnore(root);
  }

  private getDirectoryIgnore(dir: string): Ignore | null {
    if (this.ignoreCache.has(dir)) {
      return this.ignoreCache.get(dir) || null;
    }

    const ig = ignore();
    let hasPatterns = false;

    const gitignorePath = path.join(dir, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      try {
        ig.add(fs.readFileSync(gitignorePath, "utf-8"));
        hasPatterns = true;
      } catch {}
    }

    const wbgrepignorePath = path.join(dir, ".wbgrepignore");
    if (fs.existsSync(wbgrepignorePath)) {
      try {
        ig.add(fs.readFileSync(wbgrepignorePath, "utf-8"));
        hasPatterns = true;
      } catch {}
    }

    if (hasPatterns) {
      this.ignoreCache.set(dir, ig);
      return ig;
    }

    this.ignoreCache.set(dir, null as any);
    return null;
  }

  loadWbgrepignore(dirRoot: string): void {
    this.getDirectoryIgnore(dirRoot);
  }
}
