import { isMiddleware } from "../src/utils/checks.ts";
import { assert, describe, it } from "./deps.test.ts";
import { Composer } from "../src/deps.deno.ts";

describe("Utils tests", () => {
  describe("isMiddleware", () => {
    it("Composer", () => {
      const composer = new Composer();
      assert(isMiddleware(composer));
    });
    it("Composer[]", () => {
      const a = new Composer();
      const b = new Composer();
      assert(isMiddleware([a, b]));
    });
  });
});
