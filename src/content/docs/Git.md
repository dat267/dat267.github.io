---
title: Git
description: Advanced Git utilities, history rewriting, interactive rebase workflows, and repository debugging commands.
icon: seti:git
---

## Reset to Initial Commit

Reset your repository history completely and explicitly set the first commit's message to "initial commit". Uses `git rev-list --max-parents=0 HEAD` to dynamically resolve the root commit across any history depth.

```sh
git reset --soft "$(git rev-list --max-parents=0 HEAD)" && \
  git add -A && \
  git commit --amend -m "initial commit" && \
  git push origin main --force
```

## History Management

### Purge File with Filter-repo

Permanently strip a specific file from all commits using the modern `filter-repo` tool, which is significantly faster than the legacy `filter-branch` approach.

```sh
git filter-repo --path filename.mp4 --invert-paths
```

After removal, run `git push origin --force --all` to update the remote.

## Interactive Rebase

### Autosquash Fixup Commands

Stage changes that should be squashed into a specific commit using `--fixup`, then rebase with `--autosquash` to automatically arrange and squash them.

```sh
git commit --fixup <commit-hash>
git rebase -i --autosquash HEAD~10
```

Use `--fixup` when the original commit message should be preserved, or `--squash` to combine messages.

## Worktrees

### Parallel Branch Development

Check out a branch into a separate working directory without switching your current branch, enabling work on multiple features simultaneously without stashing.

```sh
git worktree add ../project-feature feature-branch
```

Clean up stale worktree references with `git worktree prune`.

## Bisect

### Automated Regression Search

Use a binary search with an automated test command to find the exact commit that introduced a regression.

```sh
git bisect start HEAD v1.0.0
git bisect run npm test
git bisect reset
```

The run command should exit 0 for good commits and non-zero for bad ones.

## Patch Series Comparison

### Inspect Changes Between Ranges

Compare two ranges of commits side-by-side, treating each commit as a single diff hunk. Useful during code review to see what changed between force-push iterations of a feature branch.

```sh
git range-diff origin/main...origin/feature~3 origin/main...origin/feature
```

Each hunk header shows the commit hash and subject for both ranges, making it easy to spot new, dropped, or modified patches.
