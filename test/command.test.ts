import { Command } from "../src/command.ts";
import { CommandOptions } from "../src/types.ts";
import { isCommandOptions, matchesPattern } from "../src/utils/checks.ts";
import {
  Api,
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertSpyCalls,
  beforeEach,
  type Chat,
  type ChatMember,
  Context,
  describe,
  it,
  type Message,
  spy,
  type Update,
  type User,
  type UserFromGetMe,
} from "./deps.test.ts";

function createRegexpMatchArray(
  match: string[],
  groups?: Record<string, string>,
  index?: number,
  input?: string,
) {
  const result = [...match];
  (result as any).groups = groups;
  (result as any).index = index;
  (result as any).input = input;
  return result as unknown as RegExpExecArray;
}

describe("Command", () => {
  const u = { id: 42, first_name: "bot", is_bot: true } as User;
  const c = { id: 100, type: "private" } as Chat;
  const m = {
    text: "a",
    caption: undefined,
    from: u,
    chat: c,
    sender_chat: c,
  } as Message;
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
  const options: CommandOptions = {
    matchOnlyAtStart: true,
    prefix: "/",
    targetedCommands: "optional",
    ignoreCase: false,
  };

  beforeEach(() => {
    m.caption = undefined;
  });

  describe("hasCommand", () => {
    describe("default behavior", () => {
      it("should match a regular non-targeted command", () => {
        m.text = "/start";
        m.entities = [{ type: "bot_command", offset: 0, length: 6 }];
        const ctx = new Context(update, api, me);
        assert(Command.hasCommand("start", options)(ctx));

        m.text = "blabla /start";
        m.entities = [{ type: "bot_command", offset: 7, length: 6 }];
        assertFalse(Command.hasCommand("start", options)(ctx));
      });

      it("should match a regular targeted command", () => {
        m.text = "/start@bot";
        m.entities = [{ type: "bot_command", offset: 0, length: 10 }];
        const ctx = new Context(update, api, me);
        assert(Command.hasCommand("start", options)(ctx));
      });

      it("should not match a regular targeted command in the middle of the message", () => {
        m.text = "blabla /start@bot";
        m.entities = [{ type: "bot_command", offset: 7, length: 10 }];
        const ctx = new Context(update, api, me);
        assertFalse(Command.hasCommand("start", options)(ctx));
      });

      it("should not match a regular targeted command with a different username", () => {
        m.text = "/start@otherbot";
        m.entities = [{ type: "bot_command", offset: 0, length: 13 }];
        const ctx = new Context(update, api, me);
        assertFalse(Command.hasCommand("start", options)(ctx));
      });

      it("should match regex commands", () => {
        m.text = "/start_123";
        m.entities = [{ type: "bot_command", offset: 0, length: 10 }];
        const ctx = new Context(update, api, me);
        assert(Command.hasCommand(/start_\d{3}/, options)(ctx));

        m.text = "blabla /start_123";
        m.entities = [{ type: "bot_command", offset: 7, length: 10 }];
        assertFalse(Command.hasCommand(/start_\d{3}/, options)(ctx));
        assert(
          Command.hasCommand(/start_\d{3}/, {
            ...options,
            matchOnlyAtStart: false,
          })(ctx),
        );

        m.text = "/start_abc";
        m.entities = [{ type: "bot_command", offset: 0, length: 10 }];
        assertFalse(Command.hasCommand(/start_\d{3}/, options)(ctx));

        m.text = "/start_123@bot";
        m.entities = [{ type: "bot_command", offset: 0, length: 14 }];
        assert(Command.hasCommand(/start_\d{3}/, options)(ctx));
      });

      it("should ignore a non-existing command", () => {
        m.text = "/start";
        m.entities = [{ type: "bot_command", offset: 0, length: 6 }];
        const ctx = new Context(update, api, me);
        assertFalse(Command.hasCommand("other", options)(ctx));
      });

      it("should not match a partial string command", () => {
        m.text = "/start_bla";
        m.entities = [{ type: "bot_command", offset: 0, length: 10 }];
        const ctx = new Context(update, api, me);
        assertFalse(Command.hasCommand("start", options)(ctx));
      });
    });

    describe("matchOnlyAtStart", () => {
      it("should match a regular non-targeted command in the middle of the message", () => {
        m.text = "blabla /start";
        m.entities = [{ type: "bot_command", offset: 7, length: 6 }];
        const ctx = new Context(update, api, me);
        assert(
          Command.hasCommand("start", {
            ...options,
            matchOnlyAtStart: false,
          })(ctx),
        );
      });

      it("should match a regular targeted command in the middle of the message", () => {
        m.text = "blabla /start@bot";
        m.entities = [{ type: "bot_command", offset: 7, length: 10 }];
        const ctx = new Context(update, api, me);
        assert(
          Command.hasCommand("start", {
            ...options,
            matchOnlyAtStart: false,
          })(ctx),
        );

        m.text = "blabla /start@otherbot";
        m.entities = [{ type: "bot_command", offset: 7, length: 13 }];
        assertFalse(
          Command.hasCommand("start", {
            ...options,
            matchOnlyAtStart: false,
          })(ctx),
        );
      });
    });

    describe("prefix", () => {
      it("should match a non-targeted command with a custom prefix", () => {
        m.text = "!start";
        m.entities = [];
        const ctx = new Context(update, api, me);
        assert(
          Command.hasCommand("start", { ...options, prefix: "!" })(
            ctx,
          ),
        );

        m.text = "blabla !start";
        assertFalse(
          Command.hasCommand("start", { ...options, prefix: "!" })(
            ctx,
          ),
        );
        assert(
          Command.hasCommand("start", {
            ...options,
            prefix: "!",
            matchOnlyAtStart: false,
          })(ctx),
        );
      });

      it("should match a targeted command with a custom prefix", () => {
        m.text = "!start@bot";
        const ctx = new Context(update, api, me);
        assert(
          Command.hasCommand("start", { ...options, prefix: "!" })(
            ctx,
          ),
        );

        m.text = "blabla !start@bot";
        assertFalse(
          Command.hasCommand("start", { ...options, prefix: "!" })(
            ctx,
          ),
        );
        assert(
          Command.hasCommand("start", {
            ...options,
            prefix: "!",
            matchOnlyAtStart: false,
          })(ctx),
        );

        m.text = "!start@otherbot";
        assertFalse(
          Command.hasCommand("start", { ...options, prefix: "!" })(
            ctx,
          ),
        );
      });

      it("should ignore a non-existing command", () => {
        m.text = "!start";
        m.entities = [{ type: "bot_command", offset: 0, length: 6 }];
        const ctx = new Context(update, api, me);
        assertFalse(
          Command.hasCommand("other", { ...options, prefix: "!" })(
            ctx,
          ),
        );
      });
    });

    describe("targetedCommands", () => {
      describe("ignored", () => {
        it("should match a non-targeted command", () => {
          m.text = "/start";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 6,
          }];
          const ctx = new Context(update, api, me);
          assert(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
            })(ctx),
          );

          m.text = "blabla /start";
          m.entities = [{
            type: "bot_command",
            offset: 7,
            length: 6,
          }];
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
            })(ctx),
          );
          assert(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
              matchOnlyAtStart: false,
            })(ctx),
          );
        });

        it("should ignore a targeted command", () => {
          m.text = "/start@bot";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 10,
          }];
          const ctx = new Context(update, api, me);
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
            })(ctx),
          );

          m.text = "blabla /start@bot";
          m.entities = [{
            type: "bot_command",
            offset: 7,
            length: 10,
          }];
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
            })(ctx),
          );

          m.text = "/start@otherbot";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 13,
          }];
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "ignored",
            })(ctx),
          );
        });
      });

      describe("required", () => {
        it("should match a targeted command", () => {
          m.text = "/start@bot";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 10,
          }];
          const ctx = new Context(update, api, me);
          assert(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "required",
            })(ctx),
          );

          m.text = "blabla /start@bot";
          m.entities = [{
            type: "bot_command",
            offset: 7,
            length: 10,
          }];
          assert(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "required",
              matchOnlyAtStart: false,
            })(ctx),
          );

          m.text = "/start@otherbot";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 13,
          }];
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "required",
            })(ctx),
          );
        });

        it("should ignore a non-targeted command", () => {
          m.text = "/start";
          m.entities = [{
            type: "bot_command",
            offset: 0,
            length: 6,
          }];
          const ctx = new Context(update, api, me);
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "required",
            })(ctx),
          );

          m.text = "blabla /start";
          m.entities = [{
            type: "bot_command",
            offset: 7,
            length: 6,
          }];
          assertFalse(
            Command.hasCommand("start", {
              ...options,
              targetedCommands: "required",
              matchOnlyAtStart: false,
            })(ctx),
          );
        });
      });
    });

    describe("ignoreCase", () => {
      describe("true", () => {
        describe("for string commands", () => {
          it("should match a command in a case-insensitive manner", () => {
            m.text = "/START";
            m.entities = [{
              type: "bot_command",
              offset: 0,
              length: 6,
            }];
            const ctx = new Context(update, api, me);
            assert(
              Command.hasCommand("start", {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
            m.text = "/start";
            assert(
              Command.hasCommand("start", {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
          });
        });
        describe("for regex commands", () => {
          it("should match a command in a case-insensitive manner", () => {
            m.text = "/START";
            m.entities = [{
              type: "bot_command",
              offset: 0,
              length: 6,
            }];
            const ctx = new Context(update, api, me);
            assert(
              Command.hasCommand(/start/, {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
            assert(
              Command.hasCommand(/start/i, {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
            m.text = "/start";
            assert(
              Command.hasCommand(/sTaRt/, {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
            assert(
              Command.hasCommand(/sTaRt/i, {
                ...options,
                ignoreCase: true,
              })(ctx),
            );
          });
        });
      });

      describe("false", () => {
        describe("for string commands", () => {
          it("should match a command in a case-sensitive manner", () => {
            m.text = "/START";
            m.entities = [{
              type: "bot_command",
              offset: 0,
              length: 6,
            }];
            const ctx = new Context(update, api, me);
            assertFalse(
              Command.hasCommand("start", {
                ...options,
                ignoreCase: false,
              })(ctx),
            );

            m.text = "/start";
            assert(
              Command.hasCommand("start", {
                ...options,
                ignoreCase: false,
              })(ctx),
            );
          });
        });
        describe("for regex commands", () => {
          describe("should match a command in a case-sensitive manner", () => {
            it("under normal conditions", () => {
              m.text = "/START";
              m.entities = [{
                type: "bot_command",
                offset: 0,
                length: 6,
              }];
              const ctx = new Context(update, api, me);
              assertFalse(
                Command.hasCommand(/start/, {
                  ...options,
                  ignoreCase: false,
                })(ctx),
              );
              m.text = "/start";
              assertFalse(
                Command.hasCommand(/START/, {
                  ...options,
                  ignoreCase: false,
                })(ctx),
              );
              m.text = "/start";
              assert(
                Command.hasCommand(/start/, {
                  ...options,
                  ignoreCase: false,
                })(ctx),
              );
            });
          });
          it("should prioritize the `i` flag even if ignoreCase is set to false", () => {
            m.text = "/START";
            m.entities = [{
              type: "bot_command",
              offset: 0,
              length: 6,
            }];
            const ctx = new Context(update, api, me);
            assert(
              Command.hasCommand(/start/i, {
                ...options,
                ignoreCase: false,
              })(ctx),
            );
          });
        });
      });
    });
  });

  describe("matchesPattern", () => {
    it("matches a string pattern", () => {
      assert(matchesPattern("start", "start"));
    });

    it("matches a regex pattern", () => {
      assert(matchesPattern("start", /start/));
    });

    it("does not match an incorrect string pattern", () => {
      assertFalse(matchesPattern("start", "other"));
    });

    it("does not match an incorrect regex pattern", () => {
      assertFalse(matchesPattern("start", /other/));
    });
  });

  describe("isApiCompliant", () => {
    it("returns false if there is a custom prefix", () => {
      const command = new Command("test", "_", { prefix: "!" });
      assertEquals(command.isApiCompliant(), [
        false,
        "Command has custom prefix: !",
      ]);
    });

    it("returns false if there is name is a regex", () => {
      const command = new Command(/test/, "_");
      assertEquals(command.isApiCompliant(), [
        false,
        "Command has a regular expression name",
      ]);
    });

    it("returns false if there are uppercase characters", () => {
      const command = new Command("testCommand", "_");
      assertEquals(command.isApiCompliant(), [
        false,
        "Command name has uppercase characters",
      ]);
    });

    it("returns false if command name is too long", () => {
      const command = new Command(
        "longnamelongnamelongnamelongnamelongname",
        "_",
      );
      assertEquals(command.isApiCompliant(), [
        false,
        "Command name is too long (40 characters). Maximum allowed is 32 characters",
      ]);
    });

    it("returns false if command name has special characters", () => {
      const command = new Command("*test!", "_");
      assertEquals(command.isApiCompliant(), [
        false,
        "Command name has special characters (*!). Only letters, digits and _ are allowed",
      ]);
    });

    it("is able to detect more than a problem at once", () => {
      const command = new Command(
        "$SUPERuncompli4ntCommand12345678",
        "_",
      );
      assertEquals(command.isApiCompliant(), [
        false,
        "Command name has uppercase characters",
        "Command name has special characters ($). Only letters, digits and _ are allowed",
      ]);
    });
  });
  describe("isCommandOptions", () => {
    it("true when an object contains valid CommandOptions properties", () => {
      let partialOpts: Partial<CommandOptions> = { prefix: "!" };
      assert(isCommandOptions(partialOpts));
      partialOpts = { matchOnlyAtStart: true };
      assert(isCommandOptions(partialOpts));
      partialOpts = { matchOnlyAtStart: false };
      assert(isCommandOptions(partialOpts));
      partialOpts = { targetedCommands: "ignored" };
      assert(isCommandOptions(partialOpts));
      partialOpts = { targetedCommands: "optional" };
      assert(isCommandOptions(partialOpts));
      partialOpts = { targetedCommands: "required" };
      assert(isCommandOptions(partialOpts));
      partialOpts = { ignoreCase: true };
      assert(isCommandOptions(partialOpts));
    });
    it("should return false when an object contains invalid types for valid CommandOptions properties", () => {
      let partialOpts: any = { prefix: true };
      assertFalse(isCommandOptions(partialOpts));
      partialOpts = { ignoreCase: "false" };
      assertFalse(isCommandOptions(partialOpts));
      partialOpts = { targetedCommands: "requirred" };
      assertFalse(isCommandOptions(partialOpts));
      partialOpts = { ignoreCase: 1 };
      assertFalse(isCommandOptions(partialOpts));
    });
    it("should return false when an object does not contain any CommandOption property", () => {
      let partialOpts: any = { papi: true };
      assertFalse(isCommandOptions(partialOpts));
    });
  });

  describe("findMatchingCommand", () => {
    it("should match a command in a caption", () => {
      m.text = undefined;
      m.caption = "/start";
      const ctx = new Context(update, api, me);
      assert(Command.findMatchingCommand("start", options, ctx) !== null);
    });

    it("should return null if the message does not contain a text or caption", () => {
      m.text = undefined;
      const ctx = new Context(update, api, me);
      assert(Command.findMatchingCommand("start", options, ctx) === null);
    });

    it("should return null if the message does not start with the prefix and matchOnlyAtStart is true", () => {
      m.text = "/start";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand("start", {
          ...options,
          prefix: "NOPE",
          matchOnlyAtStart: true,
        }, ctx),
        null,
      );
    });

    it("should correctly handle a targeted command", () => {
      m.text = "/start@bot";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand("start", options, ctx),
        {
          command: "start",
          rest: "",
        },
      );
    });

    it("should correctly handle a non-targeted command", () => {
      m.text = "/start";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand("start", options, ctx),
        {
          command: "start",
          rest: "",
        },
      );
    });

    it("should correctly handle a regex command with no args", () => {
      m.text = "/start_123";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand(/start_(\d{3})/, options, ctx),
        {
          command: /start_(\d{3})/,
          rest: "",
          match: createRegexpMatchArray(
            ["start_123", "123"],
            undefined,
            1,
            "/start_123",
          ),
        },
      );
    });

    it("should correctly handle a regex command with args", () => {
      m.text = "/start blabla";
      const ctx = new Context(update, api, me);
      const result = Command.findMatchingCommand(/start (.*)/, {
        ...options,
        targetedCommands: "optional",
      }, ctx);

      assertExists(result);
      assertEquals(
        result,
        {
          command: /start (.*)/,
          rest: "blabla",
          match: createRegexpMatchArray(
            ["start blabla", "blabla"],
            undefined,
            1,
            "/start blabla",
          ),
        },
      );
    });

    it("should handle a targeted command with a param that contains an @", () => {
      m.text = "/start@bot john@doe.com";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand("start", options, ctx),
        {
          command: "start",
          rest: "john@doe.com",
        },
      );
    });

    it("should handle a non-targeted command with a param that contains an @", () => {
      m.text = "/start john@doe.com";
      const ctx = new Context(update, api, me);
      assertEquals(Command.findMatchingCommand("start", options, ctx), {
        command: "start",
        rest: "john@doe.com",
      });
    });

    it("should handle a command after an occurence of @", () => {
      m.text = "john@doe.com /start@bot test";
      const ctx = new Context(update, api, me);
      assertEquals(
        Command.findMatchingCommand("start", {
          ...options,
          matchOnlyAtStart: false,
        }, ctx),
        {
          command: "start",
          rest: "test",
        },
      );
    });
  });

  describe("addToScope", () => {
    // NOTE: currently the scopes need to be added in a priority order for the
    // narrowest function to be called
    const command = new Command("a", "Test command");
    const mw = (ctx: Context) =>
      command.middleware()(ctx, () => Promise.resolve());
    const makeContext = (message: Message) => {
      const update = (message.chat.type === "channel")
        ? { channel_post: message as any, update_id: 1 }
        : { message: message as any, update_id: 1 };
      return new Context(update, api, me);
    };

    const chatMemberSpy = spy();
    command.addToScope(
      { type: "chat_member", chat_id: -123, user_id: 456 },
      chatMemberSpy,
    );

    const chatAdministratorsSpy = spy();
    command.addToScope(
      { type: "chat_administrators", chat_id: -123 },
      chatAdministratorsSpy,
    );

    const chatSpy = spy();
    command.addToScope({ type: "chat", chat_id: -123 }, chatSpy);

    const privateChatSpy = spy();
    command.addToScope({ type: "chat", chat_id: 456 }, privateChatSpy);

    const allChatAdministratorsSpy = spy();
    command.addToScope(
      { type: "all_chat_administrators" },
      allChatAdministratorsSpy,
    );

    const allGroupChatsSpy = spy();
    command.addToScope({ type: "all_group_chats" }, allGroupChatsSpy);

    const allPrivateChatsSpy = spy();
    command.addToScope({ type: "all_private_chats" }, allPrivateChatsSpy);

    const defaultSpy = spy();
    command.addToScope({ type: "default" }, defaultSpy);

    let chatMember: ChatMember | null = null;
    const api = {
      getChatMember: spy(() => {
        return Promise.resolve(chatMember);
      }),
    } as unknown as Api;
    beforeEach(() => {
      chatMember = { status: "member" } as ChatMember;
    });

    it("should call chatMember", async () => {
      assertSpyCalls(chatMemberSpy, 0);
      await mw(makeContext({
        chat: { id: -123, type: "group" },
        from: { id: 456 },
        text: "/a",
      } as Message));
      assertSpyCalls(chatMemberSpy, 1);
    });

    it("should call chatAdministrators", async () => {
      chatMember = { status: "administrator" } as ChatMember;

      assertSpyCalls(chatAdministratorsSpy, 0);
      await mw(makeContext({
        chat: { id: -123, type: "group" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(chatAdministratorsSpy, 1);
    });

    it("should call chat", async () => {
      assertSpyCalls(chatSpy, 0);
      await mw(makeContext({
        chat: { id: -123, type: "group" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(chatSpy, 1);
    });

    it("should call chat for a private chat", async () => {
      assertSpyCalls(privateChatSpy, 0);
      await mw(makeContext({
        chat: { id: 456, type: "private" },
        from: { id: 456 },
        text: "/a",
      } as Message));
      assertSpyCalls(privateChatSpy, 1);
    });

    it("should call allChatAdministrators", async () => {
      chatMember = { status: "administrator" } as ChatMember;

      assertSpyCalls(allChatAdministratorsSpy, 0);
      await mw(makeContext({
        chat: { id: -124, type: "group" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(allChatAdministratorsSpy, 1);
    });

    it("should call allGroupChats", async () => {
      chatMember = { status: "member" } as ChatMember;

      assertSpyCalls(allGroupChatsSpy, 0);
      await mw(makeContext({
        chat: { id: -124, type: "group" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(allGroupChatsSpy, 1);
    });

    it("should call allPrivateChats", async () => {
      assertSpyCalls(allPrivateChatsSpy, 0);
      await mw(makeContext({
        chat: { id: 789, type: "private" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(allPrivateChatsSpy, 1);
    });

    it("should call default", async () => {
      assertSpyCalls(defaultSpy, 0);
      await mw(makeContext({
        chat: { id: -124, type: "channel" },
        from: { id: 789 },
        text: "/a",
      } as Message));
      assertSpyCalls(defaultSpy, 1);
    });
  });
});
