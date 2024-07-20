import {
    assertSpyCalls,
    resolvesNext,
} from "https://deno.land/std@0.203.0/testing/mock.ts";
import { RawApi } from "https://deno.land/x/grammy@v1.27.0/mod.ts";
import { Commands } from "../src/commands.ts";
import { Bot } from "../src/deps.deno.ts";
import { commands, CommandsFlavor } from "../src/mod.ts";
import {
    Api,
    assertRejects,
    assertSpyCall,
    Chat,
    Context,
    describe,
    it,
    Message,
    spy,
    Update,
    User,
} from "./deps.test.ts";

const bot = new Bot("dummy_token");

const getDummyUpdate = ({ userInput, language, noChat }: {
    userInput?: string;
    language?: string;
    noChat?: boolean;
} = {}) => {
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

    return update;
};

describe("Integration", () => {
    describe("setCommands", () => {
        it("should call setMyCommands with valid commands", async () => {
            const myCommands = new Commands();
            myCommands.command("command", "_", (_, next) => next());

            const setMyCommandsSpy = spy(resolvesNext([true] as const));

            await myCommands.setCommands({
                api: {
                    raw: { setMyCommands: setMyCommandsSpy },
                } as unknown as Api,
            });

            assertSpyCalls(setMyCommandsSpy, 1);
            assertSpyCall(setMyCommandsSpy, 0, {
                args: [{
                    commands: [{ command: "command", description: "_" }],
                    language_code: undefined,
                    scope: {
                        type: "default",
                    },
                }],
            });
        });

        it("should error when commands have custom prefixes", async () => {
            const myCommands = new Commands({ prefix: "!" });
            myCommands.command("command", "_", (_, next) => next());

            const setMyCommandsSpy = spy(resolvesNext([true] as const));

            await assertRejects(() =>
                myCommands.setCommands({
                    api: {
                        raw: { setMyCommands: setMyCommandsSpy },
                    } as unknown as Api,
                })
            );

            assertSpyCalls(setMyCommandsSpy, 0);
        });
    });

    describe("ctx.setMyCommands", () => {
        it("should call setMyCommands with valid commands", async () => {
            const myCommands = new Commands();
            myCommands.command("command", "_", (_, next) => next());

            const setMyCommandsSpy = spy(resolvesNext([true] as const));
            const bot = new Bot<Context & CommandsFlavor>("dummy_token", {
                botInfo: {
                    id: 1,
                    is_bot: true,
                    username: "",
                    can_join_groups: true,
                    can_read_all_group_messages: true,
                    supports_inline_queries: true,
                    first_name: "",
                },
            });

            bot.use(commands());

            bot.use(async (ctx, next) => {
                // @ts-expect-error Testing purposes
                ctx.api.raw = {
                    setMyCommands: setMyCommandsSpy,
                } as unknown as RawApi;
                await ctx.setMyCommands(myCommands);
                await next();
            });

            await bot.handleUpdate(getDummyUpdate());

            assertSpyCalls(setMyCommandsSpy, 1);
            assertSpyCall(setMyCommandsSpy, 0, {
                args: [{
                    commands: [{ command: "command", description: "_" }],
                    language_code: undefined,
                    scope: {
                        type: "chat",
                        chat_id: 100,
                    },
                }],
            });
        });

        it("should error when commands have custom prefixes", async () => {
            const myCommands = new Commands();
            myCommands.command("command", "_", (_, next) => next(), {
                prefix: "!",
            });

            const setMyCommandsSpy = spy(resolvesNext([true] as const));
            const bot = new Bot<Context & CommandsFlavor>("dummy_token", {
                botInfo: {
                    id: 1,
                    is_bot: true,
                    username: "",
                    can_join_groups: true,
                    can_read_all_group_messages: true,
                    supports_inline_queries: true,
                    first_name: "",
                },
            });

            bot.use(commands());

            bot.use(async (ctx, next) => {
                // @ts-expect-error Testing purposes
                ctx.api.raw = {
                    setMyCommands: setMyCommandsSpy,
                } as unknown as RawApi;
                await assertRejects(() => ctx.setMyCommands(myCommands));
                await next();
            });

            await bot.handleUpdate(getDummyUpdate());

            assertSpyCalls(setMyCommandsSpy, 0);
        });
    });
});
