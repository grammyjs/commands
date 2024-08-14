import { resolvesNext } from "https://deno.land/std@0.203.0/testing/mock.ts";
import { Commands } from "../src/commands.ts";
import { setBotCommands } from "../src/utils/set-bot-commands.ts";
import {
  Api,
  assertRejects,
  assertSpyCall,
  describe,
  it,
  spy,
} from "./deps.test.ts";

describe("setBotCommands", () => {
  it("should throw an error if the commands are invalid", async () => {
    const myCommands = new Commands();
    myCommands.command("Command", "_", (_, next) => next()); // Uppercase letters
    myCommands.command("/command", "_", (_, next) => next()); // Invalid character
    myCommands.command(
      "longcommandlongcommandlongcommand",
      "_",
      (_, next) => next(),
    ); // Too long

    await assertRejects(
      () =>
        setBotCommands(
          {
            raw: {
              setMyCommands: () => Promise.resolve(true as const),
            },
          } as unknown as Api,
          myCommands.toArgs(),
        ),
      Error,
      [
        "setMyCommands called with commands that would cause an error from the Bot API because they are invalid.",
        "Invalid commands:",
        "Command: Command must contain only lowercase letters, digits and underscores.",
        "/command: Command must contain only lowercase letters, digits and underscores.",
        "longcommandlongcommandlongcommand: Command is too long. Max 32 characters.",
      ].join("\n"),
    );
  });

  it("should call api with valid commands only if filterInvalidCommands is true", async () => {
    const myCommands = new Commands();
    myCommands.command("Command", "_", (_, next) => next()); // Uppercase letters
    myCommands.command("/command", "_", (_, next) => next()); // Invalid character
    myCommands.command(
      "longcommandlongcommandlongcommand",
      "_",
      (_, next) => next(),
    ); // Too long
    myCommands.command("command", "_", (_, next) => next()); // Valid

    const setMyCommandsSpy = spy(resolvesNext([true] as const));

    await setBotCommands(
      { raw: { setMyCommands: setMyCommandsSpy } } as unknown as Api,
      myCommands.toArgs(),
      {
        filterInvalidCommands: true,
      },
    );

    assertSpyCall(setMyCommandsSpy, 0, {
      args: [
        {
          scope: { type: "default" },
          language_code: undefined,
          commands: [
            { command: "command", description: "_" },
          ],
        },
      ],
    });
  });
});
