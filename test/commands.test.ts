import { Commands } from "../src/commands.ts";
import { MyCommandParams } from "../src/mod.ts";
import { assertEquals, describe, it } from "./deps.test.ts";

describe("Commands", () => {
    describe("command", () => {
        it("should create a command with no handlers", () => {
            const commands = new Commands();
            commands.command("test", "no handler");

            assertEquals(commands.toArgs(), []);
        });

        it("should create a command with a default handler", () => {
            const commands = new Commands();
            commands.command("test", "default handler", () => { }, {
                prefix: undefined,
            });

            assertEquals(commands.toArgs(), [{
                commands: [{ command: "test", description: "default handler" }],
                language_code: undefined,
                scope: { type: "default" },
            }]);
        });

        it("should support options with no handler", () => {
            const commands = new Commands();
            commands.command("test", "no handler", { prefix: "test" });
            assertEquals(
                (commands as any)._commands[0]._options.prefix,
                "test",
            );
        });

        it("should support options with default handler", () => {
            const commands = new Commands();
            commands.command("test", "default handler", () => { }, {
                prefix: "test",
            });
            assertEquals(
                (commands as any)._commands[0]._options.prefix,
                "test",
            );
        });
    });
    describe("setMyCommands utils", () => {
        describe("toSingleScopeArgs", () => {
            it("should omit regex commands", () => {
                const commands = new Commands();
                commands.command("test", "handler1", (_) => _);
                commands.command("test2", "handler2", (_) => _);
                commands.command(/omitMe_\d\d/, "handler3", (_) => _);
                const params = commands.toSingleScopeArgs({
                    type: "chat",
                    chat_id: 10,
                });
                assertEquals(params, [
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: undefined,
                        commands: [
                            { command: "test", description: "handler1" },
                            { command: "test2", description: "handler2" },
                        ],
                    },
                ]);
            });
            it("should return an array with the localized versions of commands", () => {
                const commands = new Commands();
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
                assertEquals(params, [
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
                ]);
            });
            it("should omit commands with no handler", () => {
                const commands = new Commands();
                commands.command("test", "handler", (_) => _);
                commands.command("omitme", "nohandler");
                const params = commands.toSingleScopeArgs({
                    type: "chat",
                    chat_id: 10,
                });
                assertEquals(params, [
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: undefined,
                        commands: [
                            { command: "test", description: "handler" },
                        ],
                    },
                ]);
            });
        });
        describe("_mergeMyCommandsParams", () => {
            it("should merge command's from different Commands instances", () => {
                const a = new Commands();
                a.command("a", "test a", (_) => _);
                const b = new Commands();
                b.command("b", "test b", (_) => _);
                const c = new Commands();
                c.command("c", "test c", (_) => _);

                const mergedCommands = MyCommandParams.from([a, b, c], 10);

                assertEquals(mergedCommands, [
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: undefined,
                        commands: [
                            { command: "c", description: "test c" },
                            { command: "b", description: "test b" },
                            { command: "a", description: "test a" },
                        ],
                    },
                ]);
            });
            it("should merge for localized scopes", () => {
                const a = new Commands();
                a.command("a", "test a", (_) => _);
                a.command("a1", "test a1", (_) => _).localize(
                    "es",
                    "localA1",
                    "prueba a1 localizada",
                );
                a.command("a2", "test a2", (_) => _).localize(
                    "fr",
                    "localiseA2",
                    "test a2 localisé",
                );

                const b = new Commands();
                b.command("b", "test b", (_) => _)
                    .localize("es", "localB", "prueba b localizada")
                    .localize("fr", "localiseB", "prueba b localisé");

                const mergedCommands = MyCommandParams.from([a, b], 10);
                assertEquals(mergedCommands, [
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: undefined,
                        commands: [
                            { command: "b", description: "test b" },
                            { command: "a", description: "test a" },
                            { command: "a1", description: "test a1" },
                            { command: "a2", description: "test a2" },
                        ],
                    },
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: "es",
                        commands: [
                            { command: "a", description: "test a" },
                            {
                                command: "localA1",
                                description: "prueba a1 localizada",
                            },
                            { command: "a2", description: "test a2" },
                            {
                                command: "localB",
                                description: "prueba b localizada",
                            },
                        ],
                    },
                    {
                        scope: { type: "chat", chat_id: 10 },
                        language_code: "fr",
                        commands: [
                            { command: "a", description: "test a" },
                            { command: "a1", description: "test a1" },
                            {
                                command: "localiseA2",
                                description: "test a2 localisé",
                            },
                            {
                                command: "localiseB",
                                description: "prueba b localisé",
                            },
                        ],
                    },
                ]);
            });
        });
    });
});
