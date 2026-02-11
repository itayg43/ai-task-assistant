# Git Workflow

This file documents git practices, commit conventions, and branching strategies for this project.

## Pre-Commit Requirements

### Rule: All Commits Must Pass Type-Check and Tests

**Automated via pre-commit hook:**
1. `npm run type-check:ci` - TypeScript type checking
2. `npm test -- --run` - Unit and integration tests

**If either fails, the commit is blocked.**

#### Manual Pre-Commit Checklist

Before committing:
- [ ] Code compiles: `npm run type-check:ci`
- [ ] Tests pass: `npm test -- --run`
- [ ] New code has tests (if applicable)
- [ ] STATUS.md updated (if task status changed)
- [ ] No console.logs or debug code
- [ ] Imports organized properly

---

## Commit Frequency

### Rule: Commit After Each Logical Unit of Work

**Commit when:**
- ✅ Fixed one bug
- ✅ Added one feature
- ✅ Completed one refactoring
- ✅ Before switching contexts (end of work session)
- ✅ After meaningful progress (not necessarily "done")

**Don't wait to commit until:**
- ❌ End of the day
- ❌ "Everything is perfect"
- ❌ Multiple unrelated changes accumulate

**Why:** Small, frequent commits make it easier to:
- Review changes
- Identify bugs (git bisect)
- Revert problematic changes
- Understand project history

---

## Commit Messages

### Rule: Use Conventional Commit Format

**Format:**
```
type(scope): brief description

Detailed explanation of what changed and why.
Include testing details and any breaking changes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `infra`: Infrastructure/tooling changes (Docker, CI/CD)
- `chore`: Maintenance tasks (dependencies, configs)

### Scope (Optional)

Examples: `tasks`, `webhooks`, `token-usage`, `docker`, `testing`

### Examples

#### ✅ Good - Feature Commit

```
feat(token-usage): add token reconciliation for async processing

- Implement reconcileTokenUsage service function
- Add Redis metadata storage with 1-hour TTL
- Handle all error scenarios (vague input, API failures, internal errors)
- Add fire-and-forget cleanup after reconciliation

Tested:
- Unit tests for reconciliation logic (8 scenarios)
- Integration tests with real Redis
- Manual end-to-end testing with Docker Compose

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### ✅ Good - Bug Fix Commit

```
fix(webhooks): add validation for unchecked non-null assertion

Replace `taskWithSubtasks!` with explicit null check to prevent
runtime crashes if task is deleted during webhook processing.

Tested: Added test case for concurrent task deletion scenario

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### ✅ Good - Refactor Commit

```
refactor(tasks): extract duplicated token reconciliation pattern

Extracted 5 duplicated calls to reconcileTokensIfPossible into
single scheduleTokenReconciliation service method.

Benefits:
- Single place for error handling
- Consistent behavior across all call sites
- Easier to modify retry/logging logic

No behavior changes. All tests pass.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### ❌ Bad - Vague Message

```
fix: bug
```

**Problems:** What bug? Where? How was it fixed?

#### ❌ Bad - Too Much in One Commit

```
feat: add webhooks, fix tests, update docker, refactor services
```

**Problem:** Multiple unrelated changes. Should be 4 separate commits.

---

## Branch Strategy

### Main Branch

- `main`: Production-ready code
- Always deployable
- Protected: No direct commits
- Only merge via pull requests after review

### Feature Branches

**Naming:** `feature/<username>/<description>`

Examples:
- `feature/itaygur/execute-capabilities-async`
- `feature/itaygur/multi-tenant-architecture`

**Workflow:**
1. Branch from `main`: `git checkout -b feature/itaygur/new-feature`
2. Work on feature with frequent commits
3. Keep branch up to date: `git pull origin main` (rebase or merge)
4. When ready: Create pull request to `main`
5. After merge: Delete feature branch

### Bug Fix Branches

**Naming:** `fix/<username>/<description>`

Examples:
- `fix/itaygur/prisma-migration-error`
- `fix/itaygur/token-reconciliation-race-condition`

**Workflow:** Same as feature branches

### Other Branch Types

- `refactor/<username>/<description>`: Code restructuring
- `docs/<username>/<description>`: Documentation updates
- `infra/<username>/<description>`: Infrastructure changes

---

## Pull Request Process

### Creating a Pull Request

**Before creating PR:**
1. Update STATUS.md with completion status
2. All tests pass locally
3. Branch is up to date with `main`
4. Commit history is clean (no "WIP" or "fix typo" commits)

**PR Description Template:**
```markdown
## Summary
Brief description of what this PR does.

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z module

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Database tests pass (if applicable)
- [ ] Manual testing completed

## Related Issues
Closes #123 (if applicable)

## STATUS.md
- [ ] Updated to reflect completion

## Screenshots/Demos
(If applicable - UI changes, terminal output, etc.)
```

### Reviewing Pull Requests

**Review checklist:**
- [ ] Code follows project conventions (see `.claude/rules/`)
- [ ] Tests are included for new code
- [ ] No obvious bugs or security issues
- [ ] Error handling is appropriate
- [ ] Commit messages are clear
- [ ] STATUS.md reflects changes
- [ ] No unnecessary files committed (.env, logs, etc.)

---

## Merging Strategy

### Rule: Squash Small PRs, Merge Large Ones

**Squash merge when:**
- Feature is small (1-5 commits)
- Commits are WIP/"fix tests"/etc.
- Want clean main branch history

**Regular merge when:**
- Feature is large with meaningful commit history
- Commits tell a story of development
- Want to preserve detailed history

**After merging:**
- Delete feature branch
- Pull latest `main` locally
- Start new feature from updated `main`

---

## Working with STATUS.md

### Rule: Update STATUS.md with Commit References

When completing tasks from STATUS.md:

**Before:**
```markdown
#### 1. Nested Fire-and-Forget with Unhandled Rejections
- **Status:** 🔲 Not started
```

**After:**
```markdown
#### 1. Nested Fire-and-Forget with Unhandled Rejections
- **Status:** ✅ Fixed (2026-02-11)
- **Solution:** Added error handlers with logging
- **Files:** reconcile-tokens-if-possible.ts
- **Commit:** abc1234
```

**Commit message should reference STATUS.md:**
```
fix(token-usage): add error handling to fire-and-forget operations

Resolves HIGH-1 from STATUS.md: Nested fire-and-forget with unhandled rejections

Added explicit .catch() handlers to both reconciliation and cleanup operations
with structured error logging including requestId context.

Tested: Fire-and-forget error scenarios in integration tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Reverting Changes

### If You Need to Undo a Commit

**Before pushing:**
```bash
# Undo last commit, keep changes
git reset --soft HEAD~1

# Undo last commit, discard changes (careful!)
git reset --hard HEAD~1
```

**After pushing:**
```bash
# Create new commit that undoes changes
git revert <commit-hash>
```

**Why:** `git revert` is safer for shared branches - creates new commit instead of rewriting history.

---

## Git Hooks

### Pre-Commit Hook

Located at `.git/hooks/pre-commit`, runs automatically before each commit:

```bash
#!/bin/sh

echo "Running type-check..."
npm run type-check:ci
if [ $? -ne 0 ]; then
  echo "❌ Type-check failed. Commit aborted."
  exit 1
fi

echo "Running tests..."
npm test -- --run
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  exit 1
fi

echo "✅ All checks passed. Proceeding with commit."
```

**To bypass hook (emergency only):**
```bash
git commit --no-verify -m "emergency fix"
```

---

## Common Git Commands

### Daily Workflow

```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/username/new-feature

# Make changes, stage, commit
git add file1.ts file2.ts
git commit  # Opens editor for message

# Push to remote
git push origin feature/username/new-feature

# Update branch with latest main
git checkout main
git pull origin main
git checkout feature/username/new-feature
git merge main  # or git rebase main
```

### Checking Status

```bash
# See what's changed
git status

# See diff of changes
git diff

# See commit history
git log --oneline -10

# See specific commit
git show abc1234
```

---

## Summary Checklist

Before every commit:

- [ ] Run `npm run type-check:ci` (enforced by pre-commit hook)
- [ ] Run `npm test -- --run` (enforced by pre-commit hook)
- [ ] Write clear commit message (type, scope, description, details)
- [ ] Include Co-Authored-By line
- [ ] Update STATUS.md if task completed
- [ ] No debug code (console.log, commented code)
- [ ] No sensitive data (.env, credentials)

Before creating PR:

- [ ] All tests pass
- [ ] Branch up to date with main
- [ ] STATUS.md reflects completion
- [ ] PR description is clear
- [ ] Ready for review
