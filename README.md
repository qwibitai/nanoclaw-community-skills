# NanoClaw Community Skills

Community-contributed skills for [NanoClaw](https://github.com/qwibitai/nanoclaw). Anyone can submit a skill via pull request.

This repo is a fork of NanoClaw that doubles as a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces):
- **SKILL.md files** in `plugins/nanoclaw-community-skills/skills/` — instructions that Claude follows
- **Skill branches** (`skill/*`) — code changes that get merged into user forks

## Using Community Skills

### Install the marketplace

```bash
claude plugin install nanoclaw-community-skills@nanoclaw-community-skills --scope project
```

Or add to your `.claude/settings.json` for auto-loading on every session:

```json
{
  "extraKnownMarketplaces": {
    "nanoclaw-community-skills": {
      "source": {
        "source": "github",
        "repo": "qwibitai/nanoclaw-community-skills"
      }
    }
  },
  "enabledPlugins": {
    "nanoclaw-community-skills@nanoclaw-community-skills": true
  }
}
```

### Use a skill

Once installed, community skills appear as slash commands. Just type `/` and browse, or invoke directly:

```
/add-notion-sync
/add-daily-standup
/add-expense-tracker
```

Skills that modify code will merge a branch into your fork — Claude handles the merge and walks you through setup.

## Contributing a Skill

There are two types of community skills:

### Type 1: Instruction-only (no code changes)

For skills that configure existing features, add prompts, or set up external tools. The SKILL.md contains all the instructions — no branch needed.

**Example:** A skill that sets up a daily standup summary scheduled task.

1. Fork this repo
2. Create `plugins/nanoclaw-community-skills/skills/add-daily-standup/SKILL.md`:
   ```markdown
   ---
   name: add-daily-standup
   description: Schedule a daily standup summary that reviews git commits and open PRs, then messages your main channel each morning.
   ---

   # Add Daily Standup Summary

   ## Setup

   AskUserQuestion: What time should the standup run? (e.g. 9:00 AM)

   ...setup instructions...
   ```
3. Open a PR to `main`

### Type 2: Feature skill (with code changes)

For skills that add new functionality — new files, modified source, new dependencies. These need a `skill/*` branch with the code and a SKILL.md with merge instructions.

**Example:** A skill that adds Notion as an MCP tool so agents can read and update Notion pages.

1. Fork this repo
2. Create a `skill/notion-mcp` branch from `main`
3. Add your code changes on that branch (e.g. MCP server config, container mounts, documentation)
4. On `main`, create `plugins/nanoclaw-community-skills/skills/add-notion-mcp/SKILL.md`:
   ```markdown
   ---
   name: add-notion-mcp
   description: Add Notion as an MCP tool so agents can read, search, and update Notion pages and databases.
   ---

   # Add Notion MCP Integration

   ## Phase 1: Merge code changes

   git remote add community https://github.com/qwibitai/nanoclaw-community-skills.git
   git fetch community skill/notion-mcp
   git merge community/skill/notion-mcp

   ## Phase 2: Setup

   AskUserQuestion: Do you have a Notion API key, or do you need to create one?

   ...setup instructions...
   ```
5. Open a PR with both the SKILL.md (on `main`) and the branch

**Why branches work here:** This repo is a fork of NanoClaw, so `skill/*` branches share git history with user forks. `git merge community/skill/notion-mcp` works cleanly — same pattern the official skills use.

### SKILL.md format

```markdown
---
name: your-skill-name
description: What it does and when to use it
---

# Your Skill Title

Instructions here...
```

**Rules:**
- `name`: lowercase, hyphens only, max 64 chars
- `description`: required — Claude uses this to decide when to invoke the skill
- Keep SKILL.md under 500 lines — put details in separate reference files
- Use `AskUserQuestion` for interactive setup steps

### Testing locally

```bash
claude --plugin-dir ./plugins/nanoclaw-community-skills
```

Type `/your-skill-name` to verify it loads correctly.

### Review process

1. Open a PR — one skill per PR
2. A maintainer reviews the SKILL.md and any code changes
3. Once approved, the SKILL.md merges to `main` and the skill branch (if any) is pushed
4. The skill becomes available to anyone with the community marketplace installed

## Community Skills

*No community skills yet — be the first to contribute!*

## License

MIT
