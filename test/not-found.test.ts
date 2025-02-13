import { CommandsFlavor } from "../src/context.ts";
import { CommandGroup, commandNotFound } from "../src/mod.ts";
import { getDummyCtx } from "./utils.ts";
import {
  assert,
  assertEquals,
  assertFalse,
  Context,
  describe,
  it,
} from "./deps.test.ts";

describe("commandNotFound", () => {
  describe("for inputs containing '/' commands", () => {
    const ctx = getDummyCtx({ userInput: "/papacin /papazote" });
    it("should return true  when no commands are registered", () => {
      const cmds = new CommandGroup();
      const predicate = commandNotFound(cmds);
      assert(predicate(ctx));
    });
    it("should return true when only '/' commands are registered", () => {
      const cmds = new CommandGroup();
      cmds.command("papacito", "", (_) => _);
      const predicate = commandNotFound(cmds);
      assert(predicate(ctx));
    });
    it("should return false when there is only custom prefixed commands registered", () => {
      const cmds = new CommandGroup();
      cmds.command("papazote", "", (_) => _, { prefix: "?" });
      const predicate = commandNotFound(cmds);
      assertFalse(predicate(ctx));
    });
  });
  describe("for inputs containing custom prefixed commands", () => {
    const ctx = getDummyCtx({ userInput: "?papacin +papazote" });

    it("should return false if only '/' commands are registered", () => {
      const cmds = new CommandGroup();
      cmds.command("papacito", "", (_) => _);
      const predicate = commandNotFound(cmds);
      assertFalse(predicate(ctx));
    });
    it("should return false for customs registered not matching the input", () => {
      const cmds = new CommandGroup();
      cmds.command("papacito", "", (_) => _, { prefix: "&" });
      const predicate = commandNotFound(cmds);
      assertFalse(predicate(ctx));
    });
    it("should return true for exact matching the input", () => {
      const cmds = new CommandGroup();
      cmds.command("papacin", "", (_) => _, { prefix: "?" });
      cmds.command("papazote", "", (_) => _, { prefix: "+" });
      const predicate = commandNotFound(cmds);
      assert(predicate(ctx));
    });
    it("should return true for customs prefixed registered matching the input", () => {
      const cmds = new CommandGroup();
      cmds.command("papacin", "", (_) => _, { prefix: "+" });
      cmds.command("papazote", "", (_) => _, { prefix: "?" });
      const predicate = commandNotFound(cmds);
      assert(predicate(ctx));
    });
  });
  describe("ctx.commandSuggestion", () => {
    type withSuggestion =
      & CommandsFlavor<Context>
      & { commandSuggestion: string | null };

    const cmds = new CommandGroup();
    cmds.command("papazote", "", (_) => _);
    cmds.command("papacin", "", (_) => _, { prefix: "+" });
    const predicate = commandNotFound(cmds);

    it("should contain the proper suggestion ", () => {
      const ctx = getDummyCtx({ userInput: "/papacin" }) as withSuggestion;
      predicate(ctx);
      assertEquals(ctx.commandSuggestion, "+papacin");
    });
    it("should be null when the input does not match a suggestion", () => {
      const ctx = getDummyCtx({
        userInput: "/nonadapapi",
      }) as withSuggestion;
      predicate(ctx);
      assertEquals(ctx.commandSuggestion, null);
    });
  });
});
