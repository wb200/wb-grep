// Directory and paths
export const WB_GREP_DIR = ".wb-grep";

// Embedding and vector dimensions
export const VECTOR_DIMENSIONS = 1024;

// File limits
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// Ollama defaults
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3-embedding:0.6b";
export const DEFAULT_OLLAMA_TIMEOUT = 30000;
export const DEFAULT_OLLAMA_RETRIES = 3;
export const MAX_RETRY_DELAY_MS = 10000;

// Indexing defaults
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_CONCURRENCY = 8;

// Search defaults
export const DEFAULT_MAX_RESULTS = 10;

// Chunker defaults
export const DEFAULT_MAX_CHUNK_LINES = 150;
export const DEFAULT_OVERLAP_LINES = 5;
export const DEFAULT_MIN_CHUNK_LINES = 5;

// UI constants
export const BINARY_SAMPLE_SIZE = 8000;
export const WATCH_DEBOUNCE_MS = 500;
export const VERBOSE_FILE_LIMIT = 20;
export const PREVIEW_LINE_LIMIT = 10;
