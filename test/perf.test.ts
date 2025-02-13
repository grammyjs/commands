import { Command as Command_HEAD, CommandOptions } from "../src/mod.ts";
import {
  Command as Command_MAIN,
} from "https://github.com/grammyjs/commands/raw/main/src/mod.ts";
import { assert, assertEquals, describe, it } from "./deps.test.ts";
import { getDummyCtx } from "./utils.ts";

describe("Command Matching stress test", () => {
  const options: CommandOptions = {
    matchOnlyAtStart: true,
    prefix: "/",
    targetedCommands: "optional",
    ignoreCase: false,
  };

  const ctx = getDummyCtx({ userInput: "/start" });
  const m = ctx.message!;

  it("Assert new implamantation is not more than 10% slower", () => {
    let iterations = 100000;
    const init_HEAD = Date.now();
    while (iterations) {
      assertEquals(
        Command_HEAD.findMatchingCommand("start", options, ctx),
        {
          command: "start",
          rest: "",
        },
      );
      iterations--;
    }
    const finish_HEAD = Date.now();

    iterations = 100000;
    const init_MAIN = Date.now();
    while (iterations) {
      assertEquals(
        Command_MAIN.findMatchingCommand("start", options, ctx),
        {
          command: "start",
          rest: "",
        },
      );
      iterations--;
    }
    const finish_MAIN = Date.now();

    const HEAD_TIME = finish_HEAD - init_HEAD;
    const MAIN_TIME = finish_MAIN - init_MAIN;

    assert(HEAD_TIME <= MAIN_TIME + (MAIN_TIME / 100) * 10);
  });
});
