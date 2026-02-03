# VibeCode

**Multi-CLI AI coding assistant with support for Claude Code, Gemini CLI, and OpenAI Codex.**

---

## About

VibeCode is a fork of [Auto-Claude](https://github.com/AndyMik90/Auto-Claude) - an autonomous multi-agent coding framework that plans, builds, and validates software for you.

### Key Enhancements

- **Multi-Provider Support** — Switch between Claude Code, Gemini CLI, and OpenAI Codex per terminal
- **Provider Abstraction Layer** — Unified interface for all CLI providers
- **Per-Terminal Provider Selection** — Each terminal can use a different AI provider
- **Seamless Profile Switching** — Switch providers without losing context

---

## Based On

This project is based on **Auto-Claude** by AndyMik90:

**Original Repository:** [https://github.com/AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude)

Auto-Claude is an autonomous multi-agent coding framework that:
- Plans, builds, and validates software autonomously
- Uses isolated git worktrees for safe development
- Provides Kanban board for visual task management
- Supports up to 12 parallel AI-powered terminals

---

## Installation

```bash
# Clone the repository
git clone https://github.com/VladPatr96/vibecode.git
cd vibecode

# Install all dependencies
npm run install:all

# Run in development mode
npm run dev
```

---

## License

This project inherits the AGPL-3.0 license from Auto-Claude.

See [LICENSE](./agpl-3.0.txt) for details.
