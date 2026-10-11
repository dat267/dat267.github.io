import test from "node:test";
import assert from "node:assert/strict";
import autoSync from "../.pi/extensions/auto-sync.mjs";

function setup(results, hasUI = false) {
  const calls = [];
  let shutdown;
  const pi = {
    on(event, handler) {
      assert.equal(event, "session_shutdown");
      shutdown = handler;
    },
    async exec(command, args, options) {
      calls.push([command, args, options]);
      return results.shift();
    },
  };
  autoSync(pi);
  const notices = [];
  const confirms = [];
  const ctx = {
    hasUI,
    ui: {
      notify: (...args) => notices.push(args),
      confirm: async (...args) => {
        confirms.push(args);
        return true;
      },
    },
  };
  return { shutdown, calls, notices, confirms, ctx };
}

test("commits workspace changes and pushes them when Pi shuts down", async () => {
  const state = setup([
    { stdout: " M note.md\n", stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 },
    { stdout: "origin\n", stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 },
  ], true);

  await state.shutdown({}, state.ctx);

  assert.deepEqual(state.calls.map(([, args]) => args[0]), [
    "status", "add", "commit", "remote", "push",
  ]);
  assert.deepEqual(state.notices.at(-1), ["Workspace changes committed and pushed.", "info"]);
});

test("prompts to unlock SSH credentials and retries an authentication failure", async () => {
  const state = setup([
    { stdout: " M note.md\\n", stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 },
    { stdout: "origin\\n", stderr: "", code: 0 },
    { stdout: "", stderr: "Permission denied (publickey)", code: 128 },
    { stdout: "", stderr: "", code: 0 },
  ], true);

  await state.shutdown({}, state.ctx);

  assert.equal(state.confirms.length, 1);
  assert.deepEqual(state.calls.slice(-2).map(([, args]) => args), [["push"], ["push"]]);
  assert.equal(state.notices.at(-1)[0], "Workspace changes committed and pushed.");
});

test("does nothing when the workspace has no changes", async () => {
  const state = setup([{ stdout: "", stderr: "", code: 0 }]);

  await state.shutdown({}, state.ctx);

  assert.equal(state.calls.length, 1);
});
