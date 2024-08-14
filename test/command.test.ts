import { assertEquals } from "https://deno.land/std@0.203.0/assert/assert_equals.ts";
import { Command, matchesPattern } from "../src/command.ts";
import { CommandOptions } from "../src/types.ts";
import {
  Api,
  assert,
  assertFalse,
  type Chat,
  Context,
  describe,
  it,
  type Message,
  type Update,
  type User,
  type UserFromGetMe,
} from "./deps.test.ts";

describe("Command", () => {
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
  const options: CommandOptions = {
    matchOnlyAtStart: true,
    prefix: "/",
    targetedCommands: "optional",
    ignoreCase: false,
  };

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

        m.text = "blabla /start@bot";
        m.entities = [{ type: "bot_command", offset: 7, length: 10 }];
        assertFalse(Command.hasCommand("start", options)(ctx));

        m.text = "/start@otherbot";
        m.entities = [{ type: "bot_command", offset: 0, length: 13 }];
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
        "Command name has special characters (*!). Only lowercase letters, digits and _ are allowed",
      ]);
    });
  });
});
