---
title: Git
---

## Reset to inital commit

Reset your repository history and explicitly set the first commit's message to "initial commit".

Combined Command:

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD) && git add -A && git commit --amend -m "initial commit" && git push origin main --force
```

### 1. Soft Reset to Root

Move the HEAD pointer back to the very first commit while keeping all your current code changes staged in the working directory.

```sh
git reset --soft $(git rev-list --max-parents=0 HEAD)
```

### 2. Stage All Changes

Ensure all files (including new untracked files and deletions) are included in the staging area.

```sh
git add -A
```

### 3. Rewrite Root Commit with New Message

Amend the initial commit, overwriting its contents with your currently staged files and changing the commit message to "initial commit". Using `-m` overrides the previous message.

```sh
git commit --amend -m "initial commit"
```

### 4. Force Push to Remote

Overwrite the remote tracking branch with your newly squashed, single-commit history.

```sh
git push origin main --force
```
