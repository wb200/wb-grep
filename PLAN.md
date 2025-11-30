# wb-grep Implementation Plan

## Project Overview
A TypeScript fork of [mgrep](https://github.com/mixedbread-ai/mgrep) replacing the cloud-based Mixedbread embedding and vector store with:
- **Embedding**: Qwen3-Embedding-0.6B via Ollama (local, 32K context, 1024 dimensions)
- **Vector Store**: LanceDB (local, file-based, TypeScript-native)

## Technology Stack

| Component | Original (mgrep) | wb-grep (Local) |
|-----------|------------------|-----------------|
| Embedding | Mixedbread Cloud API | Qwen3-Embedding-0.6B via Ollama |
| Vector Store | Mixedbread Cloud Store | LanceDB (local file-based) |
| CLI Framework | Commander.js | Commander.js (unchanged) |
| Package Manager | pnpm | pnpm (npm compatible) |
| Build Tool | tsc | tsc (unchanged) |

## Key Advantages of Qwen3-Embedding-0.6B
- **32K token context** (vs Mixedbread ~512 or Gemini 2K)
- **1024 dimensions** output
- **State-of-the-art** performance on MTEB benchmarks
- **639MB model size** - lightweight for local GPU
- **Free forever** - no API costs
- **Offline capable** - works without internet

## Project Structure

```
wb-grep/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── commands/
│   │   ├── watch.ts            # Watch & index files
│   │   ├── search.ts           # Semantic search
│   │   └── index-cmd.ts        # Manual indexing
│   └── lib/
│       ├── embeddings.ts       # Ollama Qwen3 wrapper
│       ├── vector-store.ts     # LanceDB wrapper
│       ├── chunker.ts          # Code chunking logic
│       ├── index-state.ts      # File metadata tracking
│       ├── file.ts             # File system operations
│       └── context.ts          # Dependency injection
├── package.json
├── tsconfig.json
├── biome.json                   # Linting/formatting
└── .wb-grep/                    # Local data directory (generated)
    ├── vectors/                 # LanceDB storage
    └── state.json               # Index state
```

## Prerequisites
1. **Ollama installed**: `curl -fsSL https://ollama.com/install.sh | sh`
2. **Qwen3 model pulled**: `ollama pull qwen3-embedding:0.6b`
3. **Node.js 18+**

## Usage

```bash
# Install dependencies and build
npm install
npm run build

# Index a repository
cd /path/to/repo
wb-grep watch

# Or one-shot indexing
wb-grep index

# Search semantically
wb-grep "where is authentication handled?"
wb-grep "database connection pooling" src/lib
wb-grep -m 20 "error handling patterns"
wb-grep -c "how does the router work"  # with content preview
```

## Commands

### `wb-grep watch`
Watch for file changes and keep the index up-to-date.
- `-d, --dry-run` - Show what would be indexed without actually indexing

### `wb-grep search <pattern> [path]` (default)
Search for patterns in the indexed codebase.
- `-m, --max-count <count>` - Maximum number of results (default: 10)
- `-c, --content` - Show content snippets in results

### `wb-grep index`
One-shot indexing without watching.
- `-c, --clear` - Clear existing index before indexing
- `-p, --path <path>` - Path to index (defaults to current directory)

## Environment Variables
- `WBGREP_OLLAMA_URL` - Ollama API URL (default: http://localhost:11434)
- `WBGREP_OLLAMA_MODEL` - Embedding model (default: qwen3-embedding:0.6b)
- `WBGREP_MAX_COUNT` - Default max results (default: 10)
- `WBGREP_CONTENT` - Show content by default (default: false)

## Ignore Files
- Respects `.gitignore` patterns
- Supports `.wbgrepignore` for additional patterns

## License
Apache-2.0
