import {
    assertSpyCall,
    resolvesNext,
    Spy,
    spy,
} from "https://deno.land/std@0.203.0/testing/mock.ts";
import { Commands } from "../src/commands.ts";
import { commands, type CommandsFlavor } from "../src/mod.ts";
import {
    Api,
    assert,
    assertRejects,
    Chat,
    Context,
    describe,
    it,
    Message,
    Update,
    User,
    UserFromGetMe,
} from "./deps.test.ts";

describe("commands", () => {
    it("should install the setMyCommands method on the context", () => {
        const context = dummyCtx({});

        const middleware = commands();
        middleware(context, async () => {});

        assert(context.setMyCommands);
    });
    it("should install the getNearestCommand method on the context", () => {
        const context = dummyCtx({});

        const middleware = commands();
        middleware(context, async () => {});

        assert(context.getNearestCommand);
    });

    describe("setMyCommands", () => {
        it("should throw an error if there is no chat", async () => {
            const context = dummyCtx({ noChat: true });

            const middleware = commands();
            middleware(context, async () => {});

            await assertRejects(
                () => context.setMyCommands([]),
                Error,
                "cannot call `ctx.setMyCommands` on an update with no `chat` property",
            );
        });

        it("should throw an error if the commands are invalid", async () => {
            const context = dummyCtx({});

            const middleware = commands();
            middleware(context, async () => {});

            const myCommands = new Commands();
            myCommands.command("Command", "_", (_, next) => next()); // Uppercase letters
            myCommands.command("/command", "_", (_, next) => next()); // Invalid character
            myCommands.command(
                "longcommandlongcommandlongcommand",
                "_",
                (_, next) => next(),
            ); // Too long

            await assertRejects(
                () => context.setMyCommands(myCommands),
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
            const context = dummyCtx({});

            const middleware = commands();
            middleware(context, async () => {});

            const myCommands = new Commands();
            myCommands.command("Command", "_", (_, next) => next()); // Uppercase letters
            myCommands.command("/command", "_", (_, next) => next()); // Invalid character
            myCommands.command(
                "longcommandlongcommandlongcommand",
                "_",
                (_, next) => next(),
            ); // Too long
            myCommands.command("command", "_", (_, next) => next()); // Valid

            await context.setMyCommands(myCommands, {
                filterInvalidCommands: true,
            });

            console.log((context.api.raw.setMyCommands as Spy).calls);

            assertSpyCall(context.api.raw.setMyCommands as Spy, 0, {
                args: [
                    {
                        scope: { type: "chat", chat_id: 100 },
                        language_code: undefined,
                        commands: [
                            { command: "command", description: "_" },
                        ],
                    },
                ],
            });
        });
    });
});

export function dummyCtx({ userInput, language, noChat }: {
    userInput?: string;
    language?: string;
    noChat?: boolean;
}) {
    const u = { id: 42, first_name: "yo", language_code: language } as User;
    const c = { id: 100, type: "private" } as Chat;
    const m = {
        text: userInput,
        from: u,
        chat: noChat ? undefined : c,
    } as Message;
    const update = {
        message: m,
    } as Update;
    const api = {
        raw: { setMyCommands: spy(resolvesNext([true] as const)) },
    } as unknown as Api;
    const me = { id: 42, username: "bot" } as UserFromGetMe;
    const ctx = new Context(update, api, me) as CommandsFlavor<Context>;
    const middleware = commands();
    middleware(ctx, async () => {});
    return ctx;
}
