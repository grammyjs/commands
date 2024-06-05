import { assertArrayIncludes } from "https://deno.land/std@0.203.0/assert/assert_array_includes.ts";
import {
    distance,
    fuzzyMatch,
    JaroWinklerDistance,
} from "../src/jaro-winkler.ts";
import { Commands, commands, CommandsFlavor } from "../src/mod.ts";
import {
    Api,
    assertEquals,
    assertObjectMatch,
    Chat,
    Context,
    describe,
    it,
    Message,
    Update,
    User,
    UserFromGetMe,
} from "./deps.test.ts";
import { dummyCtx } from "./context.test.ts";

describe("Jaro-Wrinkler Algorithm", () => {
    it("should return value 0, because the empty string was given", () => {
        assertEquals(distance("", ""), 0);
    });

    it("should return the correct similarity coefficient", () => {
        assertEquals(distance("hello", "hola"), 0.6333333333333333);
    });

    it("should return value 1, because the strings are the same", () => {
        assertEquals(JaroWinklerDistance("hello", "hello", {}), 1);
    });

    it("should return value 1, because case-sensitive is turn off", () => {
        assertEquals(
            JaroWinklerDistance("hello", "HELLO", { ignoreCase: true }),
            1,
        );
    });

    describe("Fuzzy Matching", () => {
        it("should return the found command", () => {
            const cmds = new Commands<Context>();

            cmds.command(
                "start",
                "Starting",
                () => { },
            );
            assertEquals(
                fuzzyMatch("strt", cmds, { language: "fr" })?.command?.name,
                "start",
            );
        });

        it("should return null because command doesn't exist", () => {
            const cmds = new Commands<Context>();

            cmds.command(
                "start",
                "Starting",
                () => { },
            ).addToScope(
                { type: "all_private_chats" },
                (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
            );

            assertEquals(fuzzyMatch("xyz", cmds, {}), null);
        });

        it("should work for simple regex commands", () => {
            const cmds = new Commands<Context>();
            cmds.command(
                /magical_\d/,
                "Magical Command",
            ).addToScope(
                { type: "all_private_chats" },
                (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
            );
            assertEquals(
                fuzzyMatch("magcal", cmds, { language: "fr" })?.command?.name,
                "magical_\\d",
            );
        });
        it("should work for localized regex", () => {
            const cmds = new Commands<Context>();
            cmds.command(
                /magical_(a|b)/,
                "Magical Command",
            ).addToScope(
                { type: "all_private_chats" },
                (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
            ).localize("es", /magico_(c|d)/, "Comando Mágico");

            assertEquals(
                fuzzyMatch("magici_c", cmds, { language: "es" })?.command?.name,
                "magico_(c|d)",
            );
            assertEquals(
                fuzzyMatch("magici_a", cmds, { language: "fr" })?.command?.name,
                "magical_(a|b)",
            );
        });
    });
    describe("Serialize commands for FuzzyMatch", () => {
        describe("toNameAndPrefix", () => {
            const cmds = new Commands<Context>();
            cmds.command("butcher", "_", () => { }, { prefix: "?" })
                .localize("es", "carnicero", "_")
                .localize("it", "macellaio", "_");

            cmds.command("duke", "_", () => { })
                .localize("es", "duque", "_")
                .localize("fr", "duc", "_");

            it("must output all commands names, language and prefix", () => {
                const json = cmds.toElementals();
                assertArrayIncludes(json, [
                    { name: "butcher", language: "default", prefix: "?" },
                    { name: "carnicero", language: "es", prefix: "?" },
                    { name: "macellaio", language: "it", prefix: "?" },
                    { name: "duke", language: "default", prefix: "/" },
                    { name: "duque", language: "es", prefix: "/" },
                    { name: "duc", language: "fr", prefix: "/" },
                ]);
            });
        });
        describe("Should return the command localization related to the user lang", () => {
            const cmds = new Commands<Context>();
            cmds.command("duke", "sniper", () => { })
                .localize("es", "duque", "_")
                .localize("fr", "duc", "_")
                .localize("it", "duca", "_")
                .localize("pt", "duque", "_")
                .localize("de", "herzog", "_")
                .localize("sv", "hertig", "_")
                .localize("da", "hertug", "_")
                .localize("fi", "herttua", "_")
                .localize("hu", "herceg", "_");

            it("sv", () => {
                assertEquals(
                    fuzzyMatch("hertog", cmds, { language: "sv" })?.command
                        ?.name,
                    "hertig",
                );
            });
            it("da", () => {
                assertEquals(
                    fuzzyMatch("hertog", cmds, { language: "da" })?.command
                        ?.name,
                    "hertug",
                );
            });
            describe("default", () => {
                it("duke", () =>
                    assertEquals(
                        fuzzyMatch("duk", cmds, {})?.command?.name,
                        "duke",
                    ));
                it("duke", () =>
                    assertEquals(
                        fuzzyMatch("due", cmds, {})?.command?.name,
                        "duke",
                    ));
                it("duke", () =>
                    assertEquals(
                        fuzzyMatch("dule", cmds, {})?.command?.name,
                        "duke",
                    ));
                it("duke", () =>
                    assertEquals(
                        fuzzyMatch("duje", cmds, {})?.command?.name,
                        "duke",
                    ));
            });
            describe("es", () => {
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duquw", cmds, { language: "es" })?.command
                            ?.name,
                        "duque",
                    ));
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duqe", cmds, { language: "es" })?.command
                            ?.name,
                        "duque",
                    ));
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duwue", cmds, { language: "es" })?.command
                            ?.name,
                        "duque",
                    ));
            });
            describe("fr", () => {
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("duk", cmds, { language: "fr" })?.command
                            ?.name,
                        "duc",
                    ));
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("duce", cmds, { language: "fr" })?.command
                            ?.name,
                        "duc",
                    ));
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("ducñ", cmds, { language: "fr" })?.command
                            ?.name,
                        "duc",
                    ));
            });
        });
        describe("Should return the command localization related to the user lang for similar command names from different command classes", () => {
            const cmds = new Commands<Context>();
            cmds.command("push", "push", () => { })
                .localize("fr", "pousser", "a")
                .localize("pt", "empurrar", "b");

            cmds.command("rest", "rest", () => { })
                .localize("fr", "reposer", "c")
                .localize("pt", "poussar", "d");

            describe("pt rest", () => {
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("pousssr", cmds, { language: "pt" })?.command
                            ?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("pousar", cmds, { language: "pt" })?.command
                            ?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("poussqr", cmds, { language: "pt" })?.command
                            ?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("poussrr", cmds, { language: "pt" })?.command
                            ?.name,
                        "poussar",
                    ));
            });
            describe("fr push", () => {
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pousssr", cmds, { language: "fr" })?.command
                            ?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pouser", cmds, { language: "fr" })?.command
                            ?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pousrr", cmds, { language: "fr" })?.command
                            ?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("poussrr", cmds, { language: "fr" })?.command
                            ?.name,
                        "pousser",
                    ));
            });
        });
    });
    describe("Usage inside ctx", () => {
        const cmds = new Commands<Context>();
        cmds.command("butcher", "_", () => { }, { prefix: "+" })
            .localize("es", "carnicero", "_")
            .localize("it", "macellaio", "_");

        cmds.command("duke", "_", () => { })
            .localize("es", "duque", "_")
            .localize("fr", "duc", "_");

        cmds.command("daddy", "me", () => { }, { prefix: "?" })
            .localize("es", "papito", "yeyo");

        cmds.command("ender", "_", () => { });
        cmds.command("endanger", "_", () => { });
        cmds.command("entitle", "_", () => { });

        it("Should return null when no msg is given", () => {
            let ctx = dummyCtx({
                userInput: ""
            });
            assertEquals(
                ctx.getNearestCommand(cmds),
                null,
            );
        });

        describe("Should ignore localization when set to, and search trough all commands", () => {
            it("ignore even if the language is set", () => { // should this console.warn? or maybe use an overload?
                let ctx = dummyCtx({
                    userInput: "/duci",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, {
                        ignoreLocalization: true,
                    }),
                    "/duc",
                );
                ctx = dummyCtx({
                    userInput: "/duki",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, {
                        ignoreLocalization: true,
                    }),
                    "/duke",
                );
            });
            it("ignore when the language is not set", () => {
                let ctx = dummyCtx({
                    userInput: "/duki",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "/duke",
                );
                ctx = dummyCtx({
                    userInput: "/macellaoo",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "+macellaio",
                );
                ctx = dummyCtx({
                    userInput: "/dadd",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "?daddy",
                );
                ctx = dummyCtx({
                    userInput: "/duk",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "/duke",
                );
            });
            it("should not restrict itself to default", () => {
                let ctx = dummyCtx({
                    userInput: "/duqu",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "/duque",
                );
            });
            it("language not know, but ignore localization still matches the best similarity", () => {
                let ctx = dummyCtx({
                    userInput: "/duqu",
                    language: "en-papacito"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds, { ignoreLocalization: true }),
                    "/duque",
                );
            });
            it("should chose localization if not ignore", () => {
                let ctx = dummyCtx({
                    userInput: "/duku",
                    language: "es"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds),
                    "/duque",
                );
                ctx = dummyCtx({
                    userInput: "/duk",
                    language: "fr"
                });
                assertEquals(
                    ctx.getNearestCommand(cmds),
                    "/duc",
                );
            });
        });
        describe("should not fail even if the language it's not know", () => {
            it("should fallback to default", () => {
                let ctx = dummyCtx({
                    userInput: "/duko",
                    language: "en-papacito"
                });
                assertEquals(ctx.getNearestCommand(cmds), "/duke");
                ctx = dummyCtx({
                    userInput: "/butxher",
                    language: "no-language"
                });
                assertEquals(ctx.getNearestCommand(cmds), "+butcher");
            });
            it("should not fallback to a locale even if its the same name", () => {
                let ctx = dummyCtx({
                    userInput: "/duque",
                    language: "narnian"
                });
                assertEquals(ctx.getNearestCommand(cmds), "/duke");
            });
        });
        describe("should work for commands with no localization, even when the language is set", () => {
            it("ender", () => {
                let ctx = dummyCtx({
                    userInput: "/endr",
                    language: "es"
                });
                assertEquals(ctx.getNearestCommand(cmds), "/ender");
            });
            it("endanger", () => {
                let ctx = dummyCtx({
                    userInput: "/enanger",
                    language: "en"
                });
                assertEquals(ctx.getNearestCommand(cmds), "/endanger");
            });
            it("entitle", () => {
                let ctx = dummyCtx({
                    userInput: "/entities",
                    language: "pt"
                });
                assertEquals(ctx.getNearestCommand(cmds), "/entitle");
            });
        });
    });
    describe("Test multiple commands instances", () => {
        const cmds = new Commands<Context>();
        cmds.command("bread", "_", () => { })
            .localize("es", "pan", "_")
            .localize("fr", "pain", "_");

        const cmds2 = new Commands<Context>();

        cmds.command("dad", "_", () => { })
            .localize("es", "papa", "_")
            .localize("fr", "pere", "_");

        it("Should get the nearest between multiple command classes", () => {
            let ctx = dummyCtx({
                userInput: "/papi",
                language: "es"
            });
            assertEquals(ctx.getNearestCommand([cmds, cmds2]), "/papa");
            ctx = dummyCtx({
                userInput: "/pai",
                language: "fr"
            });
            assertEquals(ctx.getNearestCommand([cmds, cmds2]), "/pain");
        });
        it("Without localization it should get the best between multiple command classes", () => {
            let ctx = dummyCtx({
                userInput: "/pana",
                language: "???"
            });
            assertEquals(
                ctx.getNearestCommand([cmds, cmds2], {
                    ignoreLocalization: true,
                }),
                "/pan",
            );
            ctx = dummyCtx({
                userInput: "/para",
                language: "???"
            });
            assertEquals(
                ctx.getNearestCommand([cmds, cmds2], {
                    ignoreLocalization: true,
                }),
                "/papa",
            );
        });
    });
});

