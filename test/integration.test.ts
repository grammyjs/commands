import {
  assertSpyCalls,
  resolvesNext,
} from "https://deno.land/std@0.203.0/testing/mock.ts";
import { CommandGroup } from "../src/command-group.ts";
import { Command, commands } from "../src/mod.ts";
import {
  Api,
  assertRejects,
  assertSpyCall,
  describe,
  it,
  spy,
} from "./deps.test.ts";
import { getBot, getDummyUpdate } from "./utils.ts";

describe("Integration", () => {
  describe("setCommands", () => {
    it("should call setMyCommands with valid commands", async () => {
      const myCommands = new CommandGroup();
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
      const myCommands = new CommandGroup({ prefix: "!" });
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
      const myCommands = new CommandGroup();
      myCommands.command("command", "_", (_, next) => next());

      const setMyCommandsSpy = spy(resolvesNext([true] as const));
      const bot = getBot();

      bot.api.config.use(async (prev, method, payload, signal) => {
        if (method !== "setMyCommands") {
          return prev(method, payload, signal);
        }
        await setMyCommandsSpy(payload);

        return {
          ok: true as const,
          result: true as ReturnType<typeof prev>,
        };
      });

      bot.use(commands());

      bot.use(async (ctx, next) => {
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
      const myCommands = new CommandGroup();
      myCommands.command("command", "_", (_, next) => next(), {
        prefix: "!",
      });

      const setMyCommandsSpy = spy(resolvesNext([true] as const));
      const bot = getBot();

      bot.api.config.use(async (prev, method, payload, signal) => {
        if (method !== "setMyCommands") {
          return prev(method, payload, signal);
        }
        await setMyCommandsSpy(payload);

        return { ok: true as const, result: true as ReturnType<typeof prev> };
      });

      bot.use(commands());

      bot.use(async (ctx, next) => {
        await assertRejects(() => ctx.setMyCommands(myCommands));
        await next();
      });

      await bot.handleUpdate(getDummyUpdate());

      assertSpyCalls(setMyCommandsSpy, 0);
    });
  });

  describe("CommandGroup", () => {
    describe("command", () => {
      it("should add a command with a default handler", async () => {
        const handler = spy(() => {});

        const commandGroup = new CommandGroup();
        commandGroup.command("command", "_", handler, { prefix: "!" });

        const bot = getBot();
        bot.use(commands());
        bot.use(commandGroup);

        await bot.handleUpdate(getDummyUpdate({ userInput: "!command" }));

        assertSpyCalls(handler, 1);
      });
      it("should prioritize manually added scopes over the default handler ", async () => {
        const defaultHandler = spy(() => {});
        const specificHandler = spy(() => {});

        const commandGroup = new CommandGroup();
        commandGroup.command("command", "_", defaultHandler, { prefix: "!" })
          .addToScope({ type: "all_group_chats" }, specificHandler);

        const bot = getBot();
        bot.use(commands());
        bot.use(commandGroup);

        await bot.handleUpdate(
          getDummyUpdate({
            chatType: "group",
            userInput: "!command",
          }),
        );
        assertSpyCalls(defaultHandler, 0);
        assertSpyCalls(specificHandler, 1);
      });
      it("custom prefixed command with extra text", async () => {
        const handler = spy(() => {});

        const commandGroup = new CommandGroup();
        commandGroup.command("kick", "_", handler, { prefix: "!" });

        const bot = getBot();
        bot.use(commands());
        bot.use(commandGroup);

        await bot.handleUpdate(getDummyUpdate({ userInput: "!kick 12345" }));

        assertSpyCalls(handler, 1);
      });
    });
    describe("add", () => {
      it("should add a command that was statically created", async () => {
        const handler = spy(() => {});

        const commandGroup = new CommandGroup();
        const cmd = new Command("command", "_", handler, { prefix: "!" });
        commandGroup.add(cmd);

        const bot = getBot();
        bot.use(commands());
        bot.use(commandGroup);

        await bot.handleUpdate(getDummyUpdate({ userInput: "!command" }));

        assertSpyCalls(handler, 1);
      });
    });
  });
});
