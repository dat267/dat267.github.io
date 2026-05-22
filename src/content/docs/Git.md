---
title: Git
---

A curated collection of advanced Git utilities, performance tuning commands, and history-rewriting scripts to keep repositories clean and optimal.

## Reset to Initial Commit

Reset your repository history completely and explicitly set the first commit's message to "initial commit". This is useful when you want to wipe intermediate history but preserve current files as the baseline.

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD) && git add -A && git commit --amend -m "initial commit" && git push origin main --force
```

### 1. Soft Reset to Root

Move the HEAD pointer back to the very first commit while keeping all your current changes staged in the working directory.

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD)
```

### 2. Stage All Changes

Ensure all files (including new untracked files and deletions) are included in the staging area.

```sh
git add -A
```

### 3. Rewrite Root Commit with New Message

Amend the initial commit, overwriting its contents with your currently staged files and changing the commit message to "initial commit".

```sh
git commit --amend -m "initial commit"
```

### 4. Force Push to Remote

Overwrite the remote tracking branch with your newly squashed, single-commit history.

```sh
git push origin main --force
```

## Repository Analysis

Tools to inspect repository bloat and identify large objects tracked in the database.

### Find Top 10 Largest Files in Git History

Locate the largest blobs across all branches, tags, and historical revisions. This helps pinpoint large media files or databases that are bloating the repository size.

```sh
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '$1 == "blob" {print $3, $2, $4}' | sort -rn | head -n 10 | numfmt --to=iec-exponential --field=1
```

## History Purging

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
