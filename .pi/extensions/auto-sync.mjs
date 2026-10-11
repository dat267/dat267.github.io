const authFailure = /permission denied|authentication failed|could not read from remote repository|publickey|passphrase/i;

export default function autoSync(pi) {
  pi.on("session_shutdown", async (_event, ctx) => {
    const run = (args) => pi.exec("git", args, { cwd: ctx.cwd });
    const status = await run(["status", "--porcelain"]);
    if (status.code !== 0 || status.stdout.trim() === "") return;

    const staged = await run(["add", "-A"]);
    if (staged.code !== 0) {
      if (ctx.hasUI) ctx.ui.notify(`Auto-commit failed: ${staged.stderr.trim()}`, "error");
      return;
    }

    const commit = await run(["commit", "-m", "Save notes on Pi shutdown"]);
    if (commit.code !== 0) {
      if (ctx.hasUI) ctx.ui.notify(`Auto-commit failed: ${commit.stderr.trim()}`, "error");
      return;
    }

    const remotes = await run(["remote"]);
    if (remotes.code !== 0 || remotes.stdout.trim() === "") {
      if (ctx.hasUI) ctx.ui.notify("Changes committed locally. No Git remote is configured, so they were not pushed.", "warning");
      return;
    }

    let push = await run(["push"]);
    if (push.code !== 0 && ctx.hasUI && authFailure.test(push.stderr)) {
      const retry = await ctx.ui.confirm(
        "Unlock SSH key and retry push?",
        "Git needs SSH authentication. If your key has a passphrase, unlock it with ssh-add, then choose Retry.",
      );
      if (retry) push = await run(["push"]);
    }

    if (ctx.hasUI) {
      if (push.code === 0) {
        ctx.ui.notify("Workspace changes committed and pushed.", "info");
      } else {
        ctx.ui.notify(`Changes committed locally, but push failed: ${push.stderr.trim()}`, "warning");
      }
    }
  });
}
