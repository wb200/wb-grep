# wb-grep

**A fully local semantic grep tool for code search using Qwen3 embeddings via Ollama and LanceDB.**

wb-grep brings the power of semantic code search to your local machine without requiring any cloud services or API keys. Search your codebase using natural language queries, find related code by meaning rather than exact text matches, and keep your code indexed automatically as you work.

---

> **Note**: wb-grep is a derivative work based on [mgrep](https://github.com/mixedbread-ai/mgrep) 
> by [Mixedbread AI](https://mixedbread.com), licensed under Apache-2.0. This project replaces 
> the cloud-based embedding and vector storage with local alternatives (Ollama + LanceDB) 
> while preserving the core CLI design and architecture.

---

## What is wb-grep?

Traditional grep is an invaluable tool, but it requires you to know *exactly* what you're looking for. When exploring unfamiliar codebases, debugging complex issues, or trying to understand how features are implemented, you often need to search by *intent* rather than exact patterns.

**wb-grep solves this by:**

- **Understanding meaning**: Search for "authentication logic" and find the actual auth implementation, even if it's called `verifyCredentials` or `checkUserSession`
- **Running 100% locally**: All embeddings and vector storage happen on your machine using Ollama and LanceDB—no cloud services, no API costs, no data leaving your system
- **Staying up-to-date**: Watch mode automatically re-indexes files as you edit them
- **Being agent-friendly**: Designed to work seamlessly with coding agents, providing quiet output and thoughtful defaults

### How It Works

wb-grep uses a three-stage pipeline:

1. **Chunking**: Source files are intelligently split into semantic chunks (functions, classes, logical blocks) that preserve context
2. **Embedding**: Each chunk is converted into a 1024-dimensional vector using the Qwen3-Embedding-0.6B model running locally via Ollama
3. **Vector Search**: Queries are embedded the same way, then LanceDB finds the most similar code chunks using approximate nearest neighbor search

The result is a search experience that understands what you mean, not just what you type.

---

## Why wb-grep?

| Feature | grep/ripgrep | Cloud Semantic Search | **wb-grep** |
|---------|--------------|----------------------|-------------|
| Exact pattern matching | ✅ | ✅ | ✅ |
| Natural language queries | ❌ | ✅ | ✅ |
| Works offline | ✅ | ❌ | ✅ |
| No API costs | ✅ | ❌ | ✅ |
| Data stays local | ✅ | ❌ | ✅ |
| Automatic re-indexing | ❌ | ✅ | ✅ |
| AST-aware chunking | ❌ | ✅ | ✅ |

**Use grep for**: exact symbol tracing, regex patterns, refactoring known identifiers

**Use wb-grep for**: code exploration, feature discovery, understanding unfamiliar codebases, natural language queries

---

## Quick Start

### Prerequisites

1. **Node.js 18+** (for running wb-grep)
2. **Ollama** (for local embeddings)

### Installation

```bash
# Clone and install
git clone https://github.com/wb200/wb-grep.git
cd wb-grep
npm install
npm run build
npm link  # Makes 'wb-grep' available globally
```

### Setup Ollama

```bash
# Install Ollama (macOS)
brew install ollama

# Or on Linux
curl -fsSL https://ollama.com/install.sh | sh

# Start the Ollama server
ollama serve

# Pull the embedding model (in another terminal)
ollama pull qwen3-embedding:0.6b
```

### Your First Search

```bash
# Navigate to any codebase
cd /path/to/your/project

# Index the repository (runs once, then watches for changes)
wb-grep watch

# Search using natural language
wb-grep "where is authentication handled"
wb-grep "database connection setup"
wb-grep "error handling patterns"
```

---

## Commands

### `wb-grep search <pattern> [path]` (default)

Search for code using natural language queries. This is the default command—you can omit `search`.

```bash
# Basic search
wb-grep "function that validates user input"

# Search with path filter
wb-grep "API endpoints" src/routes

# Show more results
wb-grep -m 20 "logging configuration"

# Include code snippets in output
wb-grep -c "authentication middleware"
```

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --max-count <n>` | Maximum number of results | 10 |
| `-c, --content` | Show code snippets in results | false |

**Output Format:**
```
./src/lib/auth.ts:45-67 (85.2%)
./src/middleware/session.ts:12-28 (73.8%)
./src/utils/jwt.ts:5-22 (68.4%)
```

The percentage indicates semantic similarity—higher means more relevant.

---

### `wb-grep watch`

Index the repository and keep it up-to-date as files change.

```bash
# Start watching (indexes first, then monitors changes)
wb-grep watch

# Dry run—show what would be indexed without actually indexing
wb-grep watch --dry-run
```

| Option | Description |
|--------|-------------|
| `-d, --dry-run` | Preview files without indexing |

**What gets indexed:**
- Source code files (`.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, etc.)
- Documentation (`.md`, `.mdx`, `.txt`)
- Configuration files (`.json`, `.yaml`, `.toml`, `.xml`)
- Shell scripts (`.sh`, `.bash`, `.zsh`)
- And 50+ other file types

**What gets ignored:**
- `.gitignore` patterns are respected
- `.wbgrepignore` for additional exclusions
- Binary files, lock files, build outputs
- `node_modules`, `.git`, `dist`, `build` directories

---

### `wb-grep index`

One-shot indexing without file watching. Useful for CI/CD or when you don't need continuous updates.

```bash
# Index current directory
wb-grep index

# Index a specific path
wb-grep index --path /path/to/project

# Clear existing index and rebuild from scratch
wb-grep index --clear
```

| Option | Description |
|--------|-------------|
| `-c, --clear` | Clear existing index before indexing |
| `-p, --path <path>` | Path to index (defaults to cwd) |

---

### `wb-grep status`

Show index statistics and system status.

```bash
# Basic status
wb-grep status

# Detailed status with file list
wb-grep status --verbose
```

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed information including indexed files |

**Example Output:**
```
📊 wb-grep Status

Index Statistics:
  Files indexed:    142
  Total chunks:     1,847
  Last sync:        2024-01-15T10:32:45.000Z

Vector Store:
  Unique files:     142
  Total vectors:    1,847

Ollama Status:
  Connected:        yes
  Model available:  yes
  Model:            qwen3-embedding:0.6b
  URL:              http://localhost:11434
```

---

### `wb-grep clear`

Remove all indexed data and start fresh.

```bash
# Show warning (requires --force to actually clear)
wb-grep clear

# Actually clear the index
wb-grep clear --force
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Required to confirm deletion |

---

## Configuration

wb-grep can be configured via configuration files or environment variables.

### Configuration Files

Create one of these files in your project root:
- `.wbgreprc`
- `.wbgreprc.json`
- `wbgrep.config.json`

**Example `.wbgreprc.json`:**
```json
{
  "ollama": {
    "baseURL": "http://localhost:11434",
    "model": "qwen3-embedding:0.6b",
    "timeout": 30000,
    "retries": 3
  },
  "indexing": {
    "batchSize": 10,
    "maxFileSize": 1048576,
    "concurrency": 8
  },
  "search": {
    "maxResults": 10,
    "showContent": false
  },
  "ignore": [
    "*.generated.ts",
    "vendor/**"
  ]
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WBGREP_OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `WBGREP_OLLAMA_MODEL` | Embedding model name | `qwen3-embedding:0.6b` |
| `WBGREP_OLLAMA_TIMEOUT` | Request timeout (ms) | `30000` |
| `WBGREP_OLLAMA_RETRIES` | Number of retries | `3` |
| `WBGREP_MAX_COUNT` | Default max results | `10` |
| `WBGREP_CONTENT` | Show content by default | `false` |
| `WBGREP_BATCH_SIZE` | Indexing batch size | `10` |
| `WBGREP_CONCURRENCY` | Embedding concurrency | `8` |
| `WBGREP_LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |

**Example:**
```bash
export WBGREP_MAX_COUNT=25
export WBGREP_CONTENT=true
wb-grep "authentication"
```

### Ignore Patterns

Create a `.wbgrepignore` file in your project root to exclude additional files:

```gitignore
# Exclude generated files
*.generated.ts
*.g.dart

# Exclude specific directories
legacy/**
experiments/**

# Exclude large data files
*.csv
*.parquet
```

The syntax follows `.gitignore` conventions.

---

## Examples

### Exploring a New Codebase

```bash
# Get an overview of the architecture
wb-grep "main entry point"
wb-grep "application initialization"
wb-grep "routing configuration"

# Find specific functionality
wb-grep "user authentication flow"
wb-grep "database migrations"
wb-grep "API rate limiting"

# Understand patterns
wb-grep "error handling patterns"
wb-grep "logging implementation"
wb-grep "dependency injection"
```

### Debugging

```bash
# Find error-related code
wb-grep "where errors are thrown"
wb-grep "exception handling for network requests"

# Trace data flow
wb-grep "where user data is saved"
wb-grep "session storage implementation"
```

### Code Review

```bash
# Find security-sensitive code
wb-grep "password hashing"
wb-grep "SQL query construction"
wb-grep "file upload handling"

# Check for patterns
wb-grep "deprecated API usage"
wb-grep "TODO comments about security"
```

### With Path Filters

```bash
# Search only in specific directories
wb-grep "validation logic" src/validators
wb-grep "React hooks" src/components
wb-grep "test utilities" tests/

# Search across multiple areas
wb-grep "configuration parsing" src/config
```

### Detailed Output

```bash
# Get code snippets with results
wb-grep -c "middleware chain"

# Output:
# ./src/middleware/index.ts:15-32 (89.3%)
#   export function createMiddlewareChain(middlewares: Middleware[]) {
#     return async (ctx: Context, next: NextFunction) => {
#       let index = 0;
#       const dispatch = async (i: number): Promise<void> => {
#         if (i <= index) throw new Error('next() called multiple times');
#         index = i;
#         const fn = middlewares[i];
#         if (!fn) return next();
#         await fn(ctx, () => dispatch(i + 1));
#       };
#       return dispatch(0);
#     };
#   }
```

---

## Technical Details

### Embedding Model

wb-grep uses **Qwen3-Embedding-0.6B**, a compact but powerful embedding model:
- **Dimensions**: 1024
- **Context Length**: 32K tokens
- **Size**: ~600MB
- **Languages**: Multilingual support

The model runs locally via Ollama, ensuring your code never leaves your machine.

### Vector Storage

**LanceDB** provides the vector database:
- Embedded database (no server required)
- Fast approximate nearest neighbor search
- Efficient storage with columnar format
- Supports millions of vectors

Index data is stored in `.wb-grep/` in your project root.

### Code Chunking

Files are intelligently split into chunks that:
- Preserve function/class boundaries where possible
- Keep related code together
- Respect a maximum chunk size (~2000 characters)
- Include context (imports, surrounding code)

### File Structure

```
your-project/
├── .wb-grep/
│   ├── vectors/          # LanceDB vector store
│   └── state.json        # Index metadata
├── .wbgrepignore         # Custom ignore patterns
└── .wbgreprc.json        # Configuration (optional)
```

---

## Troubleshooting

### "Cannot connect to Ollama"

```bash
# Make sure Ollama is running
ollama serve

# Check if it's accessible
curl http://localhost:11434/api/tags
```

### "Model not found"

```bash
# Pull the embedding model
ollama pull qwen3-embedding:0.6b

# Verify it's installed
ollama list
```

### Search returns no results

```bash
# Check if files are indexed
wb-grep status

# If no files indexed, run watch or index
wb-grep watch
```

### Index seems stale

```bash
# Rebuild the index from scratch
wb-grep index --clear
```

### Performance issues

```bash
# Reduce concurrency if Ollama is overwhelmed
export WBGREP_CONCURRENCY=4

# Or increase timeout for slow systems
export WBGREP_OLLAMA_TIMEOUT=60000
```

---

## Comparison with mgrep

wb-grep is inspired by [mgrep](https://github.com/mixedbread-ai/mgrep), a cloud-based semantic grep tool by Mixedbread. The key differences:

| Feature | mgrep | wb-grep |
|---------|-------|---------|
| Embedding Provider | Mixedbread Cloud | Local Ollama |
| Vector Storage | Mixedbread Cloud | Local LanceDB |
| Authentication | Required | None |
| API Costs | Pay per use | Free |
| Data Privacy | Cloud-based | 100% local |
| Model | Mixedbread proprietary | Qwen3-Embedding-0.6B |
| Multimodal | Images, PDFs | Code/text only |

Choose **mgrep** if you want cloud convenience, multimodal search, and don't mind API costs.

Choose **wb-grep** if you need fully local operation, data privacy, or want to avoid recurring costs.

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development (watch mode)
npm run dev

# Lint and format
npm run lint
npm run format

# Type check
npm run typecheck
```

### Project Structure

```
wb-grep/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── search.ts         # Search command
│   │   ├── watch.ts          # Watch command
│   │   ├── index-cmd.ts      # Index command
│   │   ├── status.ts         # Status command
│   │   └── clear.ts          # Clear command
│   └── lib/
│       ├── embeddings.ts     # Ollama embedding client
│       ├── vector-store.ts   # LanceDB wrapper
│       ├── chunker.ts        # Code chunking logic
│       ├── indexer.ts        # Indexing orchestration
│       ├── index-state.ts    # State management
│       ├── file.ts           # File system utilities
│       ├── config.ts         # Configuration loading
│       ├── logger.ts         # Logging utilities
│       └── context.ts        # Dependency injection
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── biome.json
```

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

wb-grep is a derivative work of [mgrep](https://github.com/mixedbread-ai/mgrep) by Mixedbread AI,
which is also licensed under Apache-2.0.

---

## Acknowledgments

### Original Work

wb-grep is based on [mgrep](https://github.com/mixedbread-ai/mgrep) by [Mixedbread AI](https://mixedbread.com).
The original mgrep provides cloud-based semantic code search using Mixedbread's embedding API.
This derivative work adapts the core architecture for fully local operation.

- **Original Project**: [mixedbread-ai/mgrep](https://github.com/mixedbread-ai/mgrep)
- **Original License**: Apache-2.0
- **Original Authors**: Mixedbread AI team

### Other Dependencies

- [Ollama](https://ollama.com) - Local LLM inference
- [LanceDB](https://lancedb.com) - Embedded vector database
- [Qwen](https://github.com/QwenLM/Qwen) - Embedding model
