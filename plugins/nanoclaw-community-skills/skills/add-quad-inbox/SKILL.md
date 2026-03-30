---
name: add-quad-inbox
description: "Add async file-based task inbox for container agent to host AI communication. Use when a container agent needs to queue host-level tasks for Claude Code."
---

> Contributed by [@jorgenclaw](https://github.com/jorgenclaw) — [PR #1362](https://github.com/qwibitai/nanoclaw/pull/1362)

# Add Quad Inbox

Adds an async task handoff channel between NanoClaw container agents and Claude Code (Quad) running on the host. Container agents write natural-language task files; Claude Code reads and executes them on demand.

## What This Adds

- **`quad-inbox/` directory** in the group's workspace — where agents drop task files
- **CLAUDE.md instructions** — teaches the container agent the inbox workflow
- **`/quad-inbox` Claude Code skill** — lets Quad read, triage, execute, verify, and clear inbox tasks

## Why This Exists (Gap Analysis)

NanoClaw has several host-communication patterns, but none fit all scenarios:

| Pattern | What it is | Gap |
|---------|-----------|-----|
| **PR #816 JSON-RPC IPC** | Structured machine commands over stdio | Synchronous, requires active container run; not for natural-language work items |
| **PR #1072 /remote-control** | Spawns a live Claude Code session on the host | Real-time only; no async queue, no persistent task list |
| **PR #1295 A2A** | HTTP endpoint for external agents to call NanoClaw | Inbound only (external → NanoClaw); not outbound (NanoClaw → host AI) |

**Quad Inbox fills the remaining gap:** asynchronous, natural-language task files written by a container agent and executed by Claude Code at the human's convenience. No real-time connection. No structured protocol. Just markdown.

## Use Cases

- Container agent finds a fix that requires host-level access (e.g., patching a systemd service, updating a host config file)
- Agent needs Claude Code to apply code changes to files outside the container mount
- Agent drafts a multi-step deployment task for later execution
- Agent wants to queue follow-up work without blocking the current conversation

## How It Works

```
Container agent          Host machine (Scott)
──────────────           ──────────────────────
Writes task.md    ──→    ~/NanoClaw/groups/<group>/quad-inbox/task.md
Tells user        ──→    "I left instructions for Quad in the inbox"
                         Scott runs: /quad-inbox in Claude Code
                  ←──    Quad reads, executes, deletes task files
```

## Implementation Steps

Run all steps automatically. Only pause when explicitly needed.

### 1. Create the Inbox Directory

Identify the group this skill is being installed for. Use `AskUserQuestion` if unclear which group.

On the host, create the inbox directory inside the group's NanoClaw folder:

```bash
GROUP_FOLDER="main"   # replace with actual group folder name
mkdir -p ~/NanoClaw/groups/${GROUP_FOLDER}/quad-inbox
echo "✓ Created quad-inbox directory"
ls ~/NanoClaw/groups/${GROUP_FOLDER}/quad-inbox/
```

### 2. Update the Group's CLAUDE.md

Read the group's CLAUDE.md at `~/NanoClaw/groups/${GROUP_FOLDER}/CLAUDE.md`.

Find a good location (e.g., after any communication section, or at the end before any identity section). Add this block:

```markdown
## Quad Inbox (Host AI Communication)

When you need Quad (Claude Code on the host) to do something you can't do from inside the container — apply host-level code changes, patch system files, run host commands — write a task file to `/workspace/group/quad-inbox/`.

**File format:**

\`\`\`
# Short descriptive title

## What needs to happen
Plain English description of the task.

## Files to modify
List the host-side paths (e.g., ~/NanoClaw/src/..., ~/.config/systemd/user/...)

## Code changes
The exact changes needed — diffs, full file contents, or clear edit instructions.

## After applying
What to restart/verify. What success looks like.
\`\`\`

**Rules:**
- Be specific — include exact file paths, exact code, exact commands
- Don't assume Quad has your session context — explain the *why*
- One task per file, or clearly separate multiple tasks with headers
- Prefix filename with `urgent-` if it needs immediate attention
- If you want Quad to review before acting, add "BEFORE EXECUTING: Read this entire spec first" at the top

**Usage:**
1. Write the file: `echo "..." > /workspace/group/quad-inbox/descriptive-name.md`
2. Tell the user: "I left instructions for Quad in the inbox."
3. User runs `/quad-inbox` in Claude Code — Quad reads, triages, executes, and verifies.
4. Quad deletes the file when done. If Quad has questions, it leaves a `report-*.md` file in the inbox.
```

### 3. Create the Quad Inbox Skill

Create the `/quad-inbox` skill at `.claude/skills/quad-inbox/SKILL.md` in the NanoClaw project root:

```bash
mkdir -p ~/NanoClaw/.claude/skills/quad-inbox
```

Write the following content to `~/NanoClaw/.claude/skills/quad-inbox/SKILL.md`:

```markdown
---
name: quad-inbox
description: "Read and execute instructions left by the container agent in the quad-inbox directory. Use when the agent says it left instructions for Quad."
user_invocable: true
---

# Quad Inbox

Read and execute pending task files from the container agent.

## Steps

### 1. Scan for tasks

List all \`.md\` files in \`groups/main/quad-inbox/\`. If empty, tell the user "No pending instructions" and stop.

### 2. Triage

Read ALL task files before executing any. Present the user with a numbered summary:
- File name
- One-line description
- Priority: \`URGENT\` if the filename or first heading contains "urgent" or "critical" (case-insensitive), otherwise \`normal\`

**Check for conflicts:** If two tasks modify the same file or contradict each other (e.g., one says "rollback" and another says "restyle"), flag the conflict and ask the user which to execute. Do not silently apply both.

**Check for duplicates:** If a task asks for a change that is already present in the source code (e.g., an import already exists, a hook is already called), note this in the summary as "appears already applied — will verify."

Process \`URGENT\` tasks first, then \`normal\` tasks in alphabetical order.

### 3. Pre-flight review

For each task, before making any changes:
1. Read the entire task file
2. Identify all files that will be modified
3. Read the current state of those files
4. If the requested change is already present in the source, skip the edit and note "already applied" — but still run verification (step 5)
5. If anything looks wrong — bad file paths, logic that won't work, changes that could break something — write a brief note back to the quad-inbox explaining the issue instead of proceeding

### 4. Execute

Apply the changes described in the task file. Follow the task's instructions faithfully.

**Build rules:**
- Run \`npm run build\` after any TypeScript/JavaScript file changes. If the build fails, fix the error before proceeding. Do not delete the task file until the build passes.
- Restart NanoClaw (\`systemctl --user restart nanoclaw\`) if any \`src/\` files or service configs were changed.

### 5. Verify

Before deleting a task file, verify the result:
- If the task specifies a verification step, run it
- If the task involved a build, confirm the build passed
- If the task involved a service restart, confirm the service is running

### 6. Clean up

Delete the task file only after verification passes. Report what was done for each task.

### 7. Result reporting

If a task's outcome needs to be communicated back to the container agent (e.g., something couldn't be done, a question needs answering), write a response file to the same \`quad-inbox/\` directory with a descriptive name like \`report-<topic>.md\`. Tell the user a report was left for the agent.

## Error handling

- If a task fails, stop processing and report the error. Do NOT delete the file.
- If the build fails after edits, attempt to fix the build error. If you can't fix it, revert the changes, leave the task file, and report what went wrong.

## Notes

- Task files may contain a "BEFORE EXECUTING" preamble — this is the agent asking you to review before acting. Always honor it.
- Multiple tasks in one batch are independent unless they explicitly reference each other. Complete each fully before starting the next.
```

Verify the skill file was created:
```bash
cat ~/NanoClaw/.claude/skills/quad-inbox/SKILL.md | head -5
```

### 4. Verify the Setup

Test the full flow:

**Container side** — write a test task:
```bash
echo "# Test inbox task

## What needs to happen
Verify the quad-inbox setup is working. Just echo a success message.

## Code changes
Run: echo 'Quad inbox test successful'

## After applying
You should see 'Quad inbox test successful' in the terminal." > ~/NanoClaw/groups/${GROUP_FOLDER}/quad-inbox/test-setup.md
```

**Host side** — run `/quad-inbox` in Claude Code and confirm it reads the file and executes it. The test file should be deleted on completion.

### 5. Done

Tell the user:

> Quad Inbox is set up. When your container agent needs me to do something on the host, it writes a markdown file to `/workspace/group/quad-inbox/`. Run `/quad-inbox` here in Claude Code whenever you want me to check for and execute pending tasks.

## File Format Reference

Task files should follow this structure for best results:

```markdown
# [Action verb] [what] — e.g., "Fix shakespeare-nsp responder.js publish bug"

BEFORE EXECUTING: Read this entire spec first. If anything looks wrong, stop and write a note.

## What needs to happen
Plain English: what is broken, what should be done, and why.

## Files to modify
- `~/NanoClaw/groups/main/some-file.js` — brief description
- `~/.config/systemd/user/service.service` — brief description

## Code changes
Provide exact diffs or full replacement content. Be explicit.
Include FIND (exact) / REPLACE WITH blocks when possible.

## After applying
- What command to run to verify
- What success output looks like
- Whether a service restart is needed
```

## Lessons from Production Use

These patterns emerged from extensive real-world usage of the quad-inbox system:

- **One task per file.** Mixing unrelated changes in one file leads to partial execution and unclear failure states.
- **Include the "why" not just the "what."** Quad often needs context to resolve ambiguity — e.g., "this broke because the deploy reverted the bundle" helps more than just "fix the shelf page."
- **Exact string matches for find/replace.** Vague instructions like "find the sort block" fail when the code has been modified by prior tasks. Include the exact code to find.
- **Don't assume prior tasks landed.** If task B depends on task A, task B should verify task A's changes exist before building on them.
- **Specify verification criteria.** "Deploy and verify" is vague. "Curl this URL and confirm the title is X" is actionable.
- **Mark conflicts explicitly.** If a new task supersedes a previous one (e.g., "ignore the rollback task, apply this dark theme instead"), say so in the file.
