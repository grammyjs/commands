import { resolvesNext } from "https://deno.land/std@0.203.0/testing/mock.ts";
import { commands, CommandsFlavor } from "../src/context.ts";
import { Api, Bot, Context } from "../src/deps.deno.ts";
import {
  Chat,
  Message,
  spy,
  Update,
  User,
  UserFromGetMe,
} from "./deps.test.ts";

export const getBot = () =>
  new Bot<CommandsFlavor>("dummy_token", {
    botInfo: {
      id: 1,
      is_bot: true,
      username: "",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: true,
      first_name: "",
      can_connect_to_business: true,
      has_main_web_app: false,
    },
  });

export const getDummyUpdate = (
  { userInput, language, noChat, chatType = "private" }: {
    userInput?: string;
    language?: string;
    noChat?: boolean;
    chatType?: Chat["type"];
  } = {},
) => {
  const u = { id: 42, first_name: "yo", language_code: language } as User;
  const c = { id: 100, type: chatType } as Chat;
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

export function getDummyCtx({ userInput, language, noMessage }: {
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
