import { isMiddleware } from "../src/utils/checks.ts";
import { CommandsFlavor } from "../src/context.ts";
import { CommandGroup, commandNotFound } from "../src/mod.ts";
import { dummyCtx } from "./context.test.ts";
import {
  assert,
  assertEquals,
  assertFalse,
  Context,
  describe,
  it,
} from "./deps.test.ts";
import { Composer } from "../src/deps.deno.ts";

describe("Utils tests", () => {
  describe("isMiddleware", () => {
    it("Composer", () => {
      const composer = new Composer();
      assert(isMiddleware(composer));
    });
  });
});
