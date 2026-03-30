# Contributing to NanoClaw Community Skills

Thanks for contributing! This guide covers how to submit a skill to the community marketplace.

## Before You Start

- Check the [existing skills](README.md#community-skills) to avoid duplicates
- Search [open PRs](https://github.com/qwibitai/nanoclaw-community-skills/pulls) for similar submissions
- One skill per PR

## Skill Types

### Instruction-only (no code changes)

For skills that configure existing features, set up external tools, or add workflows.

**What to submit:**
- `plugins/nanoclaw-community-skills/skills/<your-skill>/SKILL.md`
- Optional: supporting reference files in the same directory

### Feature skill (with code changes)

For skills that add new source code to NanoClaw (new channels, integrations, etc.).

**What to submit:**
- A `skill/<name>` branch with your code changes
- `plugins/nanoclaw-community-skills/skills/<name>/SKILL.md` on `main` with merge instructions

The SKILL.md should include:
```bash
git remote add community https://github.com/qwibitai/nanoclaw-community-skills.git
git fetch community skill/<name>
git merge community/skill/<name>
```

## SKILL.md Format

```markdown
---
name: your-skill-name
description: What it does and when to use it
---

> Contributed by [@your-github](https://github.com/your-github) — [PR #N](https://github.com/qwibitai/nanoclaw-community-skills/pull/N)

# Your Skill Title

Instructions here...
```

### Rules

- `name`: lowercase, hyphens only, max 64 chars
- `description`: required — Claude uses this to decide when to invoke the skill
- Keep SKILL.md under 500 lines — put details in separate reference files
- Use `AskUserQuestion` for interactive setup steps
- Only use standard frontmatter fields (name, description, allowed-tools, model, effort, etc.)
- Add the "Contributed by" line after frontmatter for author credit

## Testing

Test your skill locally before submitting:

```bash
claude --plugin-dir ./plugins/nanoclaw-community-skills
```

Type `/your-skill-name` to verify it loads and works correctly.

## Review Process

1. Open a PR — a maintainer will review your SKILL.md and any code changes
2. We may suggest edits for clarity, safety, or compatibility
3. Once approved, the skill is merged and immediately available to anyone with the community marketplace installed

## Code of Conduct

- Skills must not collect, exfiltrate, or expose user data
- Skills must not make destructive changes without explicit user confirmation
- Skills that interact with external services must document what data is sent and where
- Be respectful in PR discussions
