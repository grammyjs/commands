import { resolvesNext } from "https://deno.land/std@0.203.0/testing/mock.ts";
import { Commands } from "../src/commands.ts";
import { setBotCommands } from "../src/utils/set-bot-commands.ts";
import {
    Api,
    assertRejects,
    assertSpyCall,
    assertThrows,
    describe,
    it,
    spy,
} from "./deps.test.ts";

describe("setBotCommands", () => {
    describe("when there are invalid commands", () => {
        const myCommands = new Commands();
        myCommands.command("Command", "_", (_, next) => next()); // Uppercase letters
        myCommands.command("/command", "_", (_, next) => next()); // Invalid character
        myCommands.command(
            "longcommandlongcommandlongcommand",
            "_",
            (_, next) => next(),
        ); // Too long
        myCommands.command("command", "_", (_, next) => next()); // Valid

        describe("when ignoreUncompliantCommands is true", () => {
            it("should call api with valid", async () => {
                const setMyCommandsSpy = spy(resolvesNext([true] as const));

                const { scopes, uncompliantCommands } = myCommands.toArgs();

                await setBotCommands(
                    {
                        raw: { setMyCommands: setMyCommandsSpy },
                    } as unknown as Api,
                    scopes,
                    uncompliantCommands,
                    {
                        ignoreUncompliantCommands: true,
                    },
                );

                assertSpyCall(setMyCommandsSpy, 0, {
                    args: [
                        {
                            scope: { type: "default" },
                            language_code: undefined,
                            commands: scopes.map((scope) => scope.commands)
                                .flat(),
                        },
                    ],
                });
            });
        });

        describe("when ignoreUncompliantCommands is false", () => {
            it("should throw", () => {
                const { scopes, uncompliantCommands } = myCommands.toArgs();
                assertRejects(() =>
                    setBotCommands({} as any, scopes, uncompliantCommands, {
                        ignoreUncompliantCommands: false,
                    })
                );
            });
        });

        describe("when ignoreUncompliantCommands is undefined", () => {
            it("should throw", () => {
                const { scopes, uncompliantCommands } = myCommands.toArgs();
                assertRejects(() =>
                    setBotCommands({} as any, scopes, uncompliantCommands)
                );
            });
        });
    });
});
