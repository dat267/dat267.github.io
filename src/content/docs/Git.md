---
title: Git
---

A curated collection of advanced Git utilities, performance tuning commands, and history-rewriting scripts to keep repositories clean and optimal.

## Reset to Initial Commit

Reset your repository history completely and explicitly set the first commit's message to "initial commit". This is useful when you want to wipe intermediate history but preserve current files as the baseline.

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD) && git add -A && git commit --amend -m "initial commit" && git push origin main --force
```

## History Management

Remove sensitive or unnecessarily large assets permanently from all revisions in the git history.

### Purge Sensitive or Large File with Filter-branch

Completely strip a specific file from all historical commits and branches, reclaiming space in the repository.

```sh
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch filename.mp4' --prune-empty --tag-name-filter cat -- --all
```

### Purge Sensitive or Large File with Filter-repo

The modern and significantly faster alternative to filter-branch, which removes files instantly from all commit paths.

```sh
git filter-repo --path filename.mp4 --invert-paths
```
