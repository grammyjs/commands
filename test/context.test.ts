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

describe("the commands function", () => {
    const u = { id: 42, first_name: "bot", is_bot: true } as User;
    const c = { id: 100, type: "private" } as Chat;
    const m = { text: "a", from: u, chat: c, sender_chat: c } as Message;
    const update = {
        message: m,
        edited_message: m,
        channel_post: m,
        edited_channel_post: m,
        inline_query: { id: "b", from: u, query: "iq" },
        chosen_inline_result: {
            from: u,
            inline_message_id: "x",
            result_id: "p",
        },
        callback_query: {
            data: "cb",
            game_short_name: "game",
            message: m,
            from: u,
            inline_message_id: "y",
        },
        shipping_query: { id: "d", from: u },
        pre_checkout_query: { id: "e", from: u },
        poll: { id: "f" },
        poll_answer: { poll_id: "g" },
        my_chat_member: { date: 1, from: u, chat: c },
        chat_member: { date: 2, from: u, chat: c },
        chat_join_request: { date: 3, from: u, chat: c },
    } as Update;

    const api = new Api("dummy-token");
    const me = { id: 42, username: "bot" } as UserFromGetMe;

    it("should install the setMyCommands method on the context", () => {
        const context = new Context(update, api, me) as CommandsFlavor<Context>;

        const middleware = commands();
        middleware(context, async () => {});

        assert(context.setMyCommands);
    });
    it("should install the getNearestCommand method on the context", () => {
        const context = new Context(update, api, me) as CommandsFlavor<Context>;

        const middleware = commands();
        middleware(context, async () => {});

        assert(context.getNearestCommand);
    });
});
