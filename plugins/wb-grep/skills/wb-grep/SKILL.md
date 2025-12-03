---
name: wb-grep
description: Semantic code search using natural language queries on locally indexed code. Use when exploring codebases or discovering how features are implemented without knowing exact names.
---

# wb-grep: Semantic Code Search

A local semantic search tool that understands what you mean, not just what you type.

## When to Use This Skill

Use wb-grep when you need to **find code by meaning**:
- Exploring unfamiliar codebases
- Don't know the exact function/variable names
- Natural language queries: "where is authentication handled?"
- Finding conceptually related code regardless of naming
- Understanding how features are implemented
- Exploring large codebases to narrow your scope

## Basic Usage

```bash
# Search with natural language
wb-grep "user authentication flow"
wb-grep "database connection setup"
wb-grep "error handling patterns"

# Search specific directory
wb-grep "API endpoints" src/routes

# Get more results
wb-grep -m 20 "logging implementation"

# Show code snippets
wb-grep -c "middleware chain"
```

## Result Format

```
./src/auth/session.ts:45-67 (85.2%)
./src/middleware/auth.ts:12-28 (73.8%)
```

The percentage indicates semantic similarity (higher = more relevant).

## Pro Tips

1. **Be specific**: Use meaningful queries, not just keywords
   - ✅ "user authentication logic"
   - ❌ "auth"

2. **Use natural language**: Describe what you're looking for
   - ✅ "where passwords are validated"
   - ❌ "hash"

3. **Combine with path filters**: Narrow results by directory
   - `wb-grep "validation" src/validators`

4. **Show context**: Use `-c` flag to see code in results
   - `wb-grep -c "request handling"`

## When NOT to Use wb-grep

Use other tools when:
- **Exact matches**: Known function/variable names → use `Grep` tool
- **Code structure**: Function calls, class definitions → use `ast-grep`
- **Quick patterns**: TODO comments, error messages → use `Grep` tool

See the **advanced-grep** skill for a comprehensive decision framework.

## Setup Requirements

- Ollama running at `http://localhost:11434`
- Model: `qwen3-embedding:0.6b`
- Repository indexed: `wb-grep watch`
