import { CommandGroup } from "../src/command-group.ts";
import { Command, MyCommandParams } from "../src/mod.ts";
import { dummyCtx } from "./context.test.ts";
import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertRejects,
  assertThrows,
  describe,
  it,
} from "./deps.test.ts";

describe("CommandGroup", () => {
  describe("command", () => {
    it("should create a command with no handlers", () => {
      const commands = new CommandGroup();
      commands.command("test", "no handler");

      assertObjectMatch(commands.toArgs().scopes[0], {
        commands: [
          {
            command: "test",
            description: "no handler",
            hasHandler: false,
          },
        ],
      });
    });

    it("should create a command with a default handler", () => {
      const commands = new CommandGroup();
      commands.command("test", "default handler", () => {}, {
        prefix: undefined,
      });

      const expected = [{
        commands: [{ command: "test", description: "default handler" }],
        language_code: undefined,
        scope: { type: "default" },
      }];
      commands.toArgs().scopes.forEach((commands, i) =>
        assertObjectMatch(commands, expected[i])
      );
    });

    it("should support options with no handler", () => {
      const commands = new CommandGroup();
      commands.command("test", "no handler", { prefix: "test" });
      assertEquals(
        (commands as any)._commands[0]._options.prefix,
        "test",
      );
    });

    it("should support options with default handler", () => {
      const commands = new CommandGroup();
      commands.command("test", "default handler", () => {}, {
        prefix: "test",
      });
      assertEquals(
        (commands as any)._commands[0]._options.prefix,
        "test",
      );
    });
  });
  describe("setMyCommands", () => {
    it("should throw if the update has no chat property", () => {
      const ctx = dummyCtx({ noMessage: true });
      const a = new CommandGroup();
      assertRejects(() => ctx.setMyCommands(a));
    });
    describe("toSingleScopeArgs", () => {
      it("should omit regex commands", () => {
        const commands = new CommandGroup();
        commands.command("test", "handler1", (_) => _);
        commands.command("test2", "handler2", (_) => _);
        commands.command(/omitMe_\d\d/, "handler3", (_) => _);
        const params = commands.toSingleScopeArgs({
          type: "chat",
          chat_id: 10,
        });
        const expected = [{
          commands: [
            { command: "test", description: "handler1" },
            { command: "test2", description: "handler2" },
          ],
        }];
        params.commandParams.forEach((commands, i) =>
          assertObjectMatch(commands, expected[i])
        );
      });
      it("should return an array with the localized versions of commands", () => {
        const commands = new CommandGroup();
        commands.command("test", "handler1", (_) => _).localize(
          "es",
          "prueba1",
          "resolvedor1",
        );
        commands.command("test2", "handler2", (_) => _);
        commands.command(/omitMe_\d\d/, "handler3", (_) => _).localize(
          "es",
          /omiteme_\d/,
          "resolvedor3",
        );

        const params = commands.toSingleScopeArgs({
          type: "chat",
          chat_id: 10,
        });
        const expected = [
          {
            scope: { type: "chat", chat_id: 10 },
            language_code: undefined,
            commands: [
              { command: "test", description: "handler1" },
              { command: "test2", description: "handler2" },
            ],
          },
          {
            scope: {
              chat_id: 10,
              type: "chat",
            },
            language_code: "es",
            commands: [
              {
                command: "prueba1",
                description: "resolvedor1",
              },
              {
                command: "test2",
                description: "handler2",
              },
            ],
          },
        ];
        params.commandParams.forEach((command, i) =>
          assertObjectMatch(command, expected[i])
        );
      });
      it("should mark commands with no handler", () => {
        const commands = new CommandGroup();
        commands.command("test", "handler", (_) => _);
        commands.command("markme", "nohandler");
        const params = commands.toSingleScopeArgs({
          type: "chat",
          chat_id: 10,
        });
        assertEquals(params.commandParams, [
          {
            scope: { type: "chat", chat_id: 10 },
            language_code: undefined,
            commands: [
              { command: "test", description: "handler", hasHandler: true },
              {
                command: "markme",
                description: "nohandler",
                hasHandler: false,
              },
            ],
          },
        ]);
      });
      it("should separate between compliant and uncompliant comands", () => {
        const commands = new CommandGroup();
        commands.command("withcustomprefix", "handler", (_) => _, {
          prefix: "!",
        });
        commands.command("withoutcustomprefix", "handler", (_) => _);

        const params = commands.toSingleScopeArgs({
          type: "chat",
          chat_id: 10,
        });
        assertEquals(params, {
          commandParams: [
            {
              scope: { type: "chat", chat_id: 10 },
              language_code: undefined,
              commands: [
                {
                  command: "withoutcustomprefix",
                  description: "handler",
                  hasHandler: true,
                },
              ],
            },
          ],
          uncompliantCommands: [
            {
              name: "withcustomprefix",
              language: "default",
              reasons: ["Command has custom prefix: !"],
            },
          ],
        });
      });
    });
    describe("merge MyCommandsParams", () => {
      it("should merge command's from different Commands instances", () => {
        const a = new CommandGroup();
        a.command("a", "test a", (_) => _);
        const b = new CommandGroup();
        b.command("b", "test b", (_) => _);
        const c = new CommandGroup();
        c.command("c", "test c", (_) => _);

        const mergedCommands = MyCommandParams.from([a, b, c], 10);
        const expected = [{
          scope: { type: "default", chat_id: 10 },
          language_code: undefined,
          commands: [
            { command: "c", description: "test c" },
            { command: "b", description: "test b" },
            { command: "a", description: "test a" },
          ],
        }];
        mergedCommands.commandsParams.forEach((command, i) =>
          assertObjectMatch(command, expected[i])
        );
      });
      it("should merge for localized scopes", () => {
        const a = new CommandGroup();
        a.command("a", "test a", (_) => _);
        a.command("a1", "test a1", (_) => _).localize(
          "es",
          "locala1",
          "prueba a1 localizada",
        );
        a.command("a2", "test a2", (_) => _).localize(
          "fr",
          "localisea2",
          "test a2 localisé",
        );

        const b = new CommandGroup();
        b.command("b", "test b", (_) => _)
          .localize("es", "localb", "prueba b localizada")
          .localize("fr", "localiseb", "prueba b localisé");

        const mergedCommands = MyCommandParams.from([a, b], 10);
        const expected = [
          {
            scope: { type: "default", chat_id: 10 },
            language_code: undefined,
            commands: [
              { command: "b", description: "test b" },
              { command: "a", description: "test a" },
              { command: "a1", description: "test a1" },
              { command: "a2", description: "test a2" },
            ],
          },
          {
            scope: { type: "default", chat_id: 10 },
            language_code: "es",
            commands: [
              {
                command: "localb",
                description: "prueba b localizada",
              },
              { command: "a", description: "test a" },
              {
                command: "locala1",
                description: "prueba a1 localizada",
              },
              { command: "a2", description: "test a2" },
            ],
          },
          {
            scope: { type: "default", chat_id: 10 },
            language_code: "fr",
            commands: [
              {
                command: "localiseb",
                description: "prueba b localisé",
              },
              { command: "a", description: "test a" },
              { command: "a1", description: "test a1" },
              {
                command: "localisea2",
                description: "test a2 localisé",
              },
            ],
          },
        ];
        mergedCommands.commandsParams.forEach((command, i) =>
          assertObjectMatch(command, expected[i])
        );
      });
      it("should merge and retain scopes between different command groups", () => {
        const a = new CommandGroup();
        a.command("a", "private chats").addToScope({
          type: "all_private_chats",
        });
        const b = new CommandGroup();
        b.command("b", "group chats").addToScope({ type: "all_group_chats" });

        const mergedCommands = MyCommandParams.from([a, b], 10);
        const expected = [{
          scope: { type: "all_group_chats", chat_id: 10 },
          language_code: undefined,
          commands: [
            { command: "b", description: "group chats" },
          ],
        }, {
          scope: { type: "all_private_chats", chat_id: 10 },
          language_code: undefined,
          commands: [
            { command: "a", description: "private chats" },
          ],
        }];
        mergedCommands.commandsParams.forEach((command, i) =>
          assertObjectMatch(command, expected[i])
        );
      });
      it("should merge and retain scopes and localization between different command groups", () => {
        const a = new CommandGroup();
        a.command("a", "private chats").addToScope({
          type: "all_private_chats",
        }).localize("es", "a_es", "private localized");

        const b = new CommandGroup();
        b.command("b", "group chats").addToScope({ type: "all_group_chats" })
          .localize("fr", "b_fr", "group localized");

        const mergedCommands = MyCommandParams.from([a, b], 10);
        const expected = [{
          scope: { type: "all_group_chats", chat_id: 10 },
          language_code: undefined,
          commands: [
            { command: "b", description: "group chats" },
          ],
        }, {
          scope: { type: "all_private_chats", chat_id: 10 },
          language_code: undefined,
          commands: [
            { command: "a", description: "private chats" },
          ],
        }, {
          scope: { type: "all_private_chats", chat_id: 10 },
          language_code: "es",
          commands: [
            { command: "a_es", description: "private localized" },
          ],
        }, {
          scope: { type: "all_group_chats", chat_id: 10 },
          language_code: "fr",
          commands: [
            { command: "b_fr", description: "group localized" },
          ],
        }];
        mergedCommands.commandsParams.forEach((command, i) =>
          assertObjectMatch(command, expected[i])
        );
      });
    });
    describe("get all prefixes registered in a Commands instance", () => {
      const a = new CommandGroup();
      a.command("a", "/", (_) => _);
      a.command("a2", "/", (_) => _);
      a.command("b", "?", (_) => _, {
        prefix: "?",
      });
      a.command("c", "abcd", (_) => _, {
        prefix: "abcd",
      });
      assertEquals(a.prefixes, ["/", "?", "abcd"]);
    });
    describe("get Entities from an update", () => {
      const a = new CommandGroup();
      a.command("a", "/", (_) => _);
      a.command("b", "?", (_) => _, {
        prefix: "?",
      });
      a.command("c", "abcd", (_) => _, {
        prefix: "abcd",
      });

      const b = new CommandGroup();
      b.command("one", "normal", (_) => _, { prefix: "superprefix" });
      const c = new CommandGroup();

      it("should only consider as entities prefixes registered in the command instance", () => {
        const text = "/papi hola papacito como estamos /papi /ecco";
        let ctx = dummyCtx({
          userInput: text,
        });
        const entities = ctx.getCommandEntities(a);
        for (const entity of entities) {
          assertEquals(
            text.substring(
              entity.offset,
              entity.offset + entity.length,
            ),
            entity.text,
          );
          assert(!"hola papacito como estamos".includes(entity.text));
        }
      });
      it("should get command entities for custom prefixes", () => {
        let ctx = dummyCtx({
          userInput: "/hi ?momi abcdfghi",
        });
        const entities = ctx.getCommandEntities(a);
        assertEquals(entities, [
          {
            text: "/hi",
            offset: 0,
            type: "bot_command",
            length: 3,
            prefix: "/",
          },
          {
            text: "?momi",
            offset: 4,
            type: "bot_command",
            length: 5,
            prefix: "?",
          },
          {
            text: "abcdfghi",
            offset: 10,
            type: "bot_command",
            length: 8,
            prefix: "abcd",
          },
        ]);
      });
      it("should throw if you call getCommandEntities on an update with no text", () => {
        const ctx = dummyCtx({});
        assertThrows(() => ctx.getCommandEntities([a, b, c]));
      });
      it("should return an empty array if the Commands classes to check against do not have any command register", () => {
        const ctx = dummyCtx({ userInput: "/papi" });
        assertEquals(ctx.getCommandEntities(c), []);
      });
      it("should work across multiple Commands instances", () => {
        const ctx = dummyCtx({ userInput: "/papi superprefixmami" });
        assertEquals(
          ctx.getCommandEntities([a, b]).map((entity) => entity.prefix),
          ["/", "superprefix"],
        );
      });
    });
  });

  describe("toArgs", () => {
    it("should return an array of SetMyCommandsParams", () => {
      const commands = new CommandGroup();
      commands.command("test", "handler", (_) => _);
      commands.command("test2", "handler2", (_) => _)
        .localize("es", "prueba2", "resolvedor2");
      commands.command("private", "private command")
        .addToScope({ type: "all_private_chats" }, (_) => _);

      const groupCommand = new Command("group", "group command")
        .addToScope({ type: "all_group_chats" }, (_) => _);

      commands.add(groupCommand);

      const params = commands.toArgs();
      const expected = [
        {
          commands: [
            { command: "test", description: "handler" },
            { command: "test2", description: "handler2" },
          ],
          language_code: undefined,
          scope: { type: "default" },
        },
        {
          commands: [
            { command: "test", description: "handler" },
            { command: "prueba2", description: "resolvedor2" },
          ],
          language_code: "es",
          scope: { type: "default" },
        },
        {
          commands: [
            { command: "private", description: "private command" },
          ],
          language_code: undefined,
          scope: { type: "all_private_chats" },
        },
        {
          commands: [
            { command: "private", description: "private command" },
          ],
          language_code: "es",
          scope: { type: "all_private_chats" },
        },
        {
          commands: [
            { command: "group", description: "group command" },
          ],
          language_code: undefined,
          scope: { type: "all_group_chats" },
        },

        {
          commands: [
            { command: "group", description: "group command" },
          ],
          language_code: "es",
          scope: { type: "all_group_chats" },
        },
      ];
      params.scopes.forEach((command, i) =>
        assertObjectMatch(command, expected[i])
      );
    });

    it("should separate between compliant and uncompliant commands", () => {
      const commands = new CommandGroup();
      commands.command("withcustomprefix", "handler", (_) => _, {
        prefix: "!",
      });
      commands.command("withoutcustomprefix", "handler", (_) => _);

      const params = commands.toArgs();
      assertObjectMatch(params, {
        scopes: [
          {
            scope: { type: "default" },
            language_code: undefined,
            commands: [
              {
                command: "withoutcustomprefix",
                description: "handler",
                hasHandler: true,
              },
            ],
          },
        ],
        uncompliantCommands: [
          {
            name: "withcustomprefix",
            language: "default",
            reasons: ["Command has custom prefix: !"],
          },
        ],
      });
    });
  });
});
