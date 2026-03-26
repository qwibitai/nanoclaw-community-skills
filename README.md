# NanoClaw Community Skills

Community-contributed skills for [NanoClaw](https://github.com/qwibitai/nanoclaw). Anyone can submit a skill via pull request.

This repo is a fork of NanoClaw that doubles as a Claude Code plugin marketplace:
- **SKILL.md files** in `plugins/nanoclaw-community-skills/skills/` — instructions that Claude follows
- **Skill branches** (`skill/*`) — actual code changes that get merged into user forks

## Installing

```bash
claude plugin install nanoclaw-community-skills@nanoclaw-community-skills --scope project
```

Or add to `.claude/settings.json` for auto-loading:

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

## Contributing a Skill

### Instruction-only skill (no code changes)

1. Fork this repo
2. Add `plugins/nanoclaw-community-skills/skills/<your-skill>/SKILL.md`
3. Open a PR

### Feature skill (with code changes)

1. Fork this repo
2. Create a `skill/<name>` branch with your code changes
3. Add a SKILL.md to `plugins/nanoclaw-community-skills/skills/<name>/` that tells Claude to merge the branch:
   ```bash
   git remote add community https://github.com/qwibitai/nanoclaw-community-skills.git
   git fetch community skill/<name>
   git merge community/skill/<name>
   ```
4. Open a PR with both the branch and the SKILL.md

### SKILL.md format

```markdown
---
name: your-skill-name
description: What it does and when to use it
---

# Your Skill

Instructions here...
```

### Guidelines

- One skill per PR
- `name`: lowercase, hyphens only, max 64 chars
- `description` is required
- Keep SKILL.md under 500 lines
- Test locally: `claude --plugin-dir ./plugins/nanoclaw-community-skills`

## Community Skills

*No community skills yet — be the first to contribute!*

## License

MIT
