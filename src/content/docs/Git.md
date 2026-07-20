---
title: Git
description: Advanced Git utilities, history rewriting, interactive rebase workflows, and repository debugging commands.
icon: seti:git
---

## Reset to Initial Commit

Reset your repository history completely and explicitly set the first commit's message to "initial commit". This is useful when you want to wipe intermediate history but preserve current files as the baseline.

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD) && git add -A && git commit --amend -m "initial commit" && git push origin main --force
```

## History Management

Remove sensitive or unnecessarily large assets permanently from all revisions in the git history.

### Purge File with Filter-branch

Completely strip a specific file from all historical commits and branches, reclaiming space in the repository.

```sh
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch filename.mp4' --prune-empty --tag-name-filter cat -- --all
```

### Purge File with Filter-repo

The modern and significantly faster alternative to filter-branch, which removes files instantly from all commit paths.

```sh
git filter-repo --path filename.mp4 --invert-paths
```

## Interactive Rebase

### Autosquash Fixup Commands

Stage changes that should be squashed into a specific commit using `--fixup`, then rebase with `--autosquash` to automatically arrange and squash them.

```sh
git commit --fixup <commit-hash>
git rebase -i --autosquash HEAD~10
```

This avoids manually reordering and marking commits as `fixup` during the interactive rebase. Use `--fixup` for changes that should replace the original commit message, or `--squash` to combine messages.

## Worktrees

### Parallel Branch Development

Check out a branch into a separate working directory without switching your current branch. This lets you work on multiple features simultaneously without stashing or committing incomplete work.

```sh
git worktree add ../project-feature feature-branch
```

After finishing, clean up with `git worktree prune`.

## Bisect

### Find the First Breaking Commit

Use a binary search across the commit history to locate the exact commit that introduced a regression.

```sh
git bisect start HEAD v1.0.0
git bisect run npm test
git bisect reset
```

Replace `npm test` with any command that exits 0 for good commits and non-0 for bad ones. Git will automatically check out the midpoint until the culprit is found.

## Staging

### Partial Staging

Stage only specific hunks of a changed file instead of the entire file, allowing you to split unrelated changes into separate commits.

```sh
git add -p file.go
```

Use `y` to stage a hunk, `n` to skip, `s` to split into smaller hunks, and `e` to manually edit the hunk.
