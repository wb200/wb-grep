# wb-grep Droid Integration Guide

This document describes the complete Factory Droid integration for wb-grep, including the plugin system, hooks, skills, and installation process.

## Overview

wb-grep integrates with Factory Droid through:

1. **Hooks** - Automatic lifecycle management (SessionStart/SessionEnd)
2. **Skills** - Decision guidance and quick references
3. **Plugin System** - Structured delivery of hooks, skills, and metadata
4. **Install Command** - One-line setup: `wb-grep install-droid`

## Architecture

### Plugin Structure

```
~/.factory/plugins/wb-grep/
├── plugin.json                      # Plugin metadata
├── hooks/
│   ├── hook.json                    # Hook configuration
│   ├── wb_grep_watch.py             # SessionStart hook
│   └── wb_grep_watch_kill.py        # SessionEnd hook
└── skills/
    └── wb-grep/
        └── SKILL.md                 # Quick reference skill
```

### Hooks System

#### SessionStart Hook (`wb_grep_watch.py`)

**Trigger**: When Droid session starts or resumes

**Behavior**:
- Reads hook input from stdin (contains `session_id`, `cwd`)
- Checks if `wb-grep watch` already running for session
- Starts `wb-grep watch` in background with process group
- Saves PID to `/tmp/wb-grep-watch-pid-{session_id}.txt`
- Returns context message to Droid about watch status

**Environment Variables**:
- `${DROID_PLUGIN_ROOT}` - Plugin directory path
- `WB_GREP_WATCH_LOG` - Override log file location (default: `/tmp/wb-grep-watch.log`)

**Exit Codes**:
- 0: Success (whether started fresh or already running)
- Non-zero: Error (but doesn't block session start)

#### SessionEnd Hook (`wb_grep_watch_kill.py`)

**Trigger**: When Droid session ends

**Behavior**:
- Reads hook input from stdin (contains `session_id`)
- Looks up PID from `/tmp/wb-grep-watch-pid-{session_id}.txt`
- Sends SIGTERM to process group
- Cleans up PID and log files
- Graceful failure (never blocks session end)

**Exit Codes**:
- 0: Always (cleanup is best-effort)

### Skills

#### Quick Reference Skill (`skills/wb-grep/SKILL.md`)

**Purpose**: Fast, focused reference for using wb-grep

**Content**:
- When to use wb-grep (semantic search)
- Basic usage examples
- Result format interpretation
- Pro tips for effective queries
- When NOT to use (point to ast-grep or Grep)

**Discoverability**: Registered in plugin.json, auto-loaded by Droid

#### Advanced-Grep Skill (Pre-existing)

**Purpose**: Comprehensive decision framework

**Content**:
- Complete comparison: wb-grep vs Grep vs ast-grep
- Decision tree for tool selection
- Tool-specific patterns and examples
- Hybrid strategies combining tools

**Location**: `~/.factory/skills/advanced-grep/` (installed separately)

**Usage**: Referenced by wb-grep skill for deeper guidance

## Installation

### One-Line Setup

```bash
wb-grep install-droid
```

### What install-droid Does

1. **Checks Ollama**:
   - Verifies connectivity to `http://localhost:11434`
   - Confirms `qwen3-embedding:0.6b` model is available
   - Fails gracefully if prerequisites missing

2. **Checks Index**:
   - Reports whether repository is indexed
   - Shows file and chunk statistics

3. **Installs Plugin**:
   - Copies `plugins/wb-grep/` to `~/.factory/plugins/wb-grep/`
   - Preserves existing installation (use `--force` to reinstall)
   - Makes Python hook scripts executable

4. **Verifies Skills**:
   - Checks if advanced-grep skill exists
   - Warns if missing (informational only)

5. **Reports Success**:
   - Shows plugin structure
   - Provides usage examples
   - Lists next steps

### Command Options

```bash
# Standard installation
wb-grep install-droid

# Verify installation without changes
wb-grep install-droid --verify

# Force reinstallation
wb-grep install-droid --force
```

## Usage with Droid

### Automatic Integration

Once installed, wb-grep automatically integrates:

1. **Session Start**: Watch mode activates
   ```
   [SessionStart] wb-grep watch started (PID: 12345). Index updates will happen automatically.
   ```

2. **During Session**: Use semantic search
   ```bash
   droid> Find the authentication middleware
   # Droid can invoke: wb-grep "authentication middleware"
   ```

3. **Session End**: Watch mode terminates cleanly

### Invoking from Droid

**Direct Execution**:
```bash
droid> /exec wb-grep "user authentication flow"
```

**Via Execute Tool**:
```bash
droid> Run wb-grep to search for error handling
```

**Via Skills**:
```bash
# Uses advanced-grep skill for guidance
droid> Where should I look for rate limiting?
# Skill response: Use wb-grep "rate limiting"
```

## Hook Configuration Format

### hook.json Structure

```json
{
  "description": "...",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${DROID_PLUGIN_ROOT}/hooks/wb_grep_watch.py",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${DROID_PLUGIN_ROOT}/hooks/wb_grep_watch_kill.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Hook Input Format

Both hooks receive JSON via stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "SessionStart|SessionEnd",
  "source": "startup|resume",  // SessionStart only
  "reason": "exit|clear|logout"  // SessionEnd only
}
```

### Hook Output Format

Hooks should output JSON to stdout for context injection:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart|SessionEnd",
    "additionalContext": "Status message or context for Droid"
  }
}
```

## Troubleshooting

### Plugin Not Found

```bash
# Check installation
ls ~/.factory/plugins/wb-grep/

# Reinstall if missing
wb-grep install-droid --force

# Verify plugin metadata
cat ~/.factory/plugins/wb-grep/plugin.json
```

### Hooks Failing

```bash
# Check hook logs
tail -f /tmp/wb-grep-watch.log

# Test hook manually
python3 ~/.factory/plugins/wb-grep/hooks/wb_grep_watch.py < /dev/null

# Verify Ollama
curl http://localhost:11434/api/tags
```

### Watch Mode Not Starting

```bash
# Check if already running
pgrep -f "wb-grep watch"

# Check process logs
cat /tmp/wb-grep-watch-{session_id}.log

# Test manually
cd /path/to/project && wb-grep watch
```

### Permissions Issues

```bash
# Make scripts executable
chmod +x ~/.factory/plugins/wb-grep/hooks/*.py

# Verify ownership
ls -la ~/.factory/plugins/wb-grep/
```

## Development

### Modifying Hooks

1. Edit `plugins/wb-grep/hooks/wb_grep_watch.py` or `wb_grep_watch_kill.py`
2. Rebuild: `npm run build`
3. Reinstall: `wb-grep install-droid --force`
4. Test in new Droid session

### Modifying Skills

1. Edit `plugins/wb-grep/skills/wb-grep/SKILL.md`
2. Rebuild: `npm run build`
3. Reinstall: `wb-grep install-droid --force`
4. Skill auto-loads on next Droid restart

### Adding More Hooks

Update `plugins/wb-grep/hooks/hook.json` to add hooks for other Droid events:
- PreToolUse, PostToolUse
- Notification
- UserPromptSubmit
- Stop, SubagentStop
- PreCompact

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| Plugin Source | `{wb-grep}/plugins/wb-grep/` | Repository version |
| Plugin Install | `~/.factory/plugins/wb-grep/` | User's Droid installation |
| Hook Logs | `/tmp/wb-grep-watch.log` | Debug output |
| Session PID | `/tmp/wb-grep-watch-pid-{id}.txt` | Process tracking |
| Session Log | `/tmp/wb-grep-watch-{id}.log` | Watch command output |

## Integration with Advanced-Grep Skill

The wb-grep quick reference skill is complementary to the existing advanced-grep skill:

**Advanced-Grep Skill** (comprehensive decision framework):
- Explains all three tools
- Provides decision tree
- Shows when to use each tool
- Hybrid strategies

**wb-Grep Quick Skill** (focused reference):
- Quick "when to use"
- Basic examples
- Common patterns
- Directs to advanced-grep for deeper guidance

**Workflow**:
```
User Query
    ↓
Droid evaluates context
    ↓
Recommends advanced-grep skill for full guidance
    ↓
User chooses tool
    ↓
If wb-grep: advanced-grep skill provides quick reference
```

## Best Practices

1. **Keep Ollama Running**: Watch mode requires active Ollama instance
   ```bash
   # In background terminal
   ollama serve
   ```

2. **Monitor Watch Mode**: Check status periodically
   ```bash
   wb-grep status
   ```

3. **Index Large Repos Beforehand**: Don't wait for first Droid session
   ```bash
   wb-grep watch &  # Let it index before starting Droid
   sleep 10
   droid  # Now start Droid with populated index
   ```

4. **Clean Up Stale Files**: Manually remove old session files if needed
   ```bash
   rm /tmp/wb-grep-watch-pid-*.txt
   ```

5. **Debug Hooks**: Set environment variable for verbose logging
   ```bash
   export WB_GREP_WATCH_LOG=$HOME/.factory/debug/wb-grep-watch.log
   ```

## Design Decisions

### 1. Minimal Skill to Avoid Redundancy with Advanced-Grep

**Problem**: mgrep has a minimal skill, and wb-grep already has comprehensive advanced-grep skill available

**Solution**:
- Created minimal quick-reference skill (`plugins/wb-grep/skills/wb-grep/SKILL.md`)
- Kept existing advanced-grep skill unchanged
- Quick skill references advanced-grep for deeper guidance
- No duplication; complementary approach

**Result**: Focused, non-redundant documentation that guides users to appropriate tools without repeating comprehensive comparisons.

### 2. Hooks for Lifecycle Automation

**Problem**: Need to keep watch mode running across Droid sessions for continuously updated embeddings

**Solution**:
- SessionStart hook starts `wb-grep watch` in background process group
- SessionEnd hook cleanly terminates with SIGTERM
- Uses PID tracking for safe multi-session operation
- Graceful failure (never blocks Droid)

**Result**: Automatic, seamless integration without manual watch process management

### 3. One-Line Installation Command

**Problem**: Plugin files need to be delivered and installed for Droid to discover them

**Solution**:
- Include plugins in source repo (`plugins/wb-grep/`)
- `install-droid` command copies to `~/.factory/plugins/wb-grep/`
- Users run one command for full setup
- Can reinstall or verify with flags (`--force`, `--verify`)

**Result**: Frictionless setup - one command does all verification and installation

### 4. Error Handling Strategy

**SessionStart Hook**:
- Never blocks Droid session if watch fails to start
- Returns status via context message
- Logs all errors for debugging

**SessionEnd Hook**:
- Always exits with code 0 (never blocks session end)
- Best-effort cleanup of PID and log files
- Graceful handling of already-terminated processes

**Result**: Robust integration that degrades gracefully without disrupting Droid sessions

## Implementation Status

### Build and Testing
```bash
✓ npm run build       # TypeScript compilation successful
✓ npm run typecheck   # No type errors
✓ npm run lint        # No linting errors
✓ npm link            # Global binary installed
```

### Plugin Files Created
```
✓ plugins/wb-grep/hooks/hook.json (28 lines)
✓ plugins/wb-grep/hooks/wb_grep_watch.py (99 lines, executable)
✓ plugins/wb-grep/hooks/wb_grep_watch_kill.py (110 lines, executable)
✓ plugins/wb-grep/skills/wb-grep/SKILL.md (76 lines)
✓ plugins/wb-grep/plugin.json (27 lines)
✓ src/commands/install-droid.ts (218 lines)
```

### Files Modified
- `src/index.ts` - Added install-droid command registration (+2 lines)
- `README.md` - Added Droid integration section (+97 lines)

### Git Commit
```
16b11a3 - Feat: Complete Factory Droid integration with hooks and skills
```

## Compatibility

### Requirements Met
- ✅ Factory Droid CLI compatible (v1.0.0+)
- ✅ Hooks system (SessionStart/SessionEnd)
- ✅ Skills system (auto-discovered via plugin.json)
- ✅ Plugin metadata format (plugin.json with ${DROID_PLUGIN_ROOT})
- ✅ Hook configuration (hook.json with matcher patterns)

### Environment & Dependencies
- TypeScript 5.6.3
- Node.js 18+
- Python 3 (for hooks)
- Ollama (for embeddings)
- Factory Droid CLI v1.0.0+

### Known Limitations
- Requires Ollama running separately (can be improved with hook auto-start in future)
- Works on Unix-like systems (Windows support untested for process groups)
- Python 3 required for hook scripts
- Single embedding model (qwen3-embedding:0.6b)

## NPM Publication

### Published Package
- **Package Name**: `wb-grep`
- **Version**: `0.1.0`
- **Registry**: https://www.npmjs.com/package/wb-grep
- **Installation**: `npm install -g wb-grep`

### Package Contents
- Compiled TypeScript (dist/) with source maps
- All dependencies bundled
- Executable CLI binary
- Complete documentation (README, DROID_INTEGRATION.md)
- License and attribution files (Apache-2.0)
- Plugin system files

### Package Size
- **Tarball**: 41.4 kB
- **Unpacked**: 191.1 kB
- **Files**: 54 total

## Future Enhancements

### Planned Improvements
1. **Auto-start Ollama**: Hook could detect and start Ollama if not running
2. **Multiple Instances**: Better concurrent session handling
3. **Windows Support**: Process group handling for Windows systems
4. **Health Checks**: Periodic verification of watch process health
5. **Metrics Collection**: Track search queries, latency, and result quality
6. **PreToolUse Hooks**: Intercept Grep/ast-grep to suggest wb-grep when appropriate
7. **Model Selection**: Allow users to choose embedding model during installation
8. **Performance Optimization**: Caching strategies for frequently searched patterns

## Related Documentation

- [README.md](./README.md) - Main wb-grep documentation
- [Factory Hooks Reference](https://docs.factory.ai/reference/hooks-reference) - Hook system details
- [Factory Skills Guide](https://docs.factory.ai/cli/configuration/skills) - Skill creation
- [mgrep Integration](https://github.com/mixedbread-ai/mgrep/tree/main/plugins/mgrep) - Original inspiration

---

**Status**: ✅ **COMPLETE - Production Ready**
**Latest Commit**: `16b11a3 - Feat: Complete Factory Droid integration with hooks and skills`
**NPM Package**: https://www.npmjs.com/package/wb-grep
**GitHub Repository**: https://github.com/wb200/wb-grep
