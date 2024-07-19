import { commands, type CommandsFlavor } from "../src/mod.ts";
import {
    Api,
    assert,
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
});

export function dummyCtx({
    userInput,
    language,
    noChat,
}: {
    userInput?: string;
    language?: string;
    noChat?: boolean;
}) {
    const u = { id: 42, first_name: "yo", language_code: language } as User;
    const c = { id: 100, type: "private" } as Chat;
    const m = noChat ? undefined : ({
        text: userInput,
        from: u,
        chat: c,
    } as Message);
    const update = {
        message: m,
    } as Update;
    const api = new Api("dummy-token");
    const me = { id: 42, username: "bot" } as UserFromGetMe;
    const ctx = new Context(update, api, me) as CommandsFlavor<Context>;
    const middleware = commands();
    middleware(ctx, async () => {});
    return ctx;
}
