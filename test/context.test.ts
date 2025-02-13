import { commands } from "../src/mod.ts";
import { assert, assertRejects, describe, it } from "./deps.test.ts";
import { getDummyCtx } from "./utils.ts";

describe("commands", () => {
  it("should install the setMyCommands method on the context", () => {
    const context = getDummyCtx({});

    const middleware = commands();
    middleware(context, async () => {});

    assert(context.setMyCommands);
  });
  it("should install the getNearestCommand method on the context", () => {
    const context = getDummyCtx({});

    const middleware = commands();
    middleware(context, async () => {});

    assert(context.getNearestCommand);
  });

  describe("setMyCommands", () => {
    it("should throw an error if there is no chat", async () => {
      const context = getDummyCtx({ noMessage: true });

      const middleware = commands();
      middleware(context, async () => {});

      await assertRejects(
        () => context.setMyCommands([]),
        Error,
        "cannot call `ctx.setMyCommands` on an update with no `chat` property",
      );
    });
  });
});
