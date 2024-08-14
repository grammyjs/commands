import {
    resolvesNext,
    spy,
} from "https://deno.land/std@0.203.0/testing/mock.ts";
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
            const context = dummyCtx({ noMessage: true });

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

export function dummyCtx({ userInput, language, noMessage }: {
    userInput?: string;
    language?: string;
    noMessage?: boolean;
}) {
    const u = { id: 42, first_name: "yo", language_code: language } as User;
    const c = { id: 100, type: "private" } as Chat;
    const m = noMessage ? undefined : ({
        text: userInput,
        from: u,
        chat: c,
    } as Message);
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
