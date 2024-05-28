import {
    distance,
    fuzzyMatch,
    JaroWinklerDistance,
} from "../src/jaro-winkler.ts";
import { Commands } from "../src/mod.ts";
import { assertEquals, Context, describe, it } from "./deps.test.ts";

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
            ).addToScope(
                { type: "all_private_chats" },
                (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
            );

            assertEquals(
                fuzzyMatch("strt", cmds, { language: "fr" })?.name,
                "start",
            );
        });

        it("should return null because command doesn't exist", () => {
            const cmds = new Commands<Context>();

            cmds.command(
                "start",
                "Starting",
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
                fuzzyMatch("magcal", cmds, { language: "fr" })?.name,
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
                fuzzyMatch("magici_c", cmds, { language: "es" })?.name,
                "magico_(c|d)",
            );
            assertEquals(
                fuzzyMatch("magici_a", cmds, { language: "fr" })?.name,
                "magical_(a|b)",
            );
        });
    });
    describe("Serialize commands for FuzzyMatch", () => {
        describe("toNameAndPrefix", () => {
            it("the resulting Array must contain the localized or default version depending on the input", () => {
                const cmds = new Commands<Context>();
                cmds.command("butcher", "green beret", () => {});
                cmds.command("duke", "sniper", () => {}).localize(
                    "es",
                    "duque",
                    "francotirador",
                );
                cmds.command("fins", "marine", () => {}).addToScope({
                    type: "all_private_chats",
                }, () => {});

                let json = cmds.toNameAndPrefix();
                assertEquals(json[1].name, "duke");
                json = cmds.toNameAndPrefix("es");
                assertEquals(json[1].name, "duque");
            });
        });
        describe("Should return the command localization related to the user lang", () => {
            const cmds = new Commands<Context>();
            cmds.command("duke", "sniper", () => {})
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
                    fuzzyMatch("hertog", cmds, { language: "sv" })?.name,
                    "hertig",
                );
            });
            it("da", () => {
                assertEquals(
                    fuzzyMatch("hertog", cmds, { language: "da" })?.name,
                    "hertug",
                );
            });
            describe("default", () => {
                it("duke", () =>
                    assertEquals(fuzzyMatch("duk", cmds, {})?.name, "duke"));
                it("duke", () =>
                    assertEquals(fuzzyMatch("due", cmds, {})?.name, "duke"));
                it("duke", () =>
                    assertEquals(fuzzyMatch("dule", cmds, {})?.name, "duke"));
                it("duke", () =>
                    assertEquals(fuzzyMatch("duje", cmds, {})?.name, "duke"));
            });
            describe("es", () => {
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duquw", cmds, { language: "es" })?.name,
                        "duque",
                    ));
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duqe", cmds, { language: "es" })?.name,
                        "duque",
                    ));
                it("duque", () =>
                    assertEquals(
                        fuzzyMatch("duwue", cmds, { language: "es" })?.name,
                        "duque",
                    ));
            });
            describe("fr", () => {
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("duk", cmds, { language: "fr" })?.name,
                        "duc",
                    ));
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("duce", cmds, { language: "fr" })?.name,
                        "duc",
                    ));
                it("duc", () =>
                    assertEquals(
                        fuzzyMatch("ducñ", cmds, { language: "fr" })?.name,
                        "duc",
                    ));
            });
        });
        describe("Should return the command localization related to the user lang for similar command names from different command classes", () => {
            const cmds = new Commands<Context>();
            cmds.command("push", "push", () => {})
                .localize("fr", "pousser", "a")
                .localize("pt", "empurrar", "b");

            cmds.command("rest", "rest", () => {})
                .localize("fr", "reposer", "c")
                .localize("pt", "poussar", "d");

            describe("pt rest", () => {
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("pousssr", cmds, { language: "pt" })?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("pousar", cmds, { language: "pt" })?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("poussqr", cmds, { language: "pt" })?.name,
                        "poussar",
                    ));
                it("poussar", () =>
                    assertEquals(
                        fuzzyMatch("poussrr", cmds, { language: "pt" })?.name,
                        "poussar",
                    ));
            });
            describe("fr push", () => {
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pousssr", cmds, { language: "fr" })?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pouser", cmds, { language: "fr" })?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("pousrr", cmds, { language: "fr" })?.name,
                        "pousser",
                    ));
                it("pousser", () =>
                    assertEquals(
                        fuzzyMatch("poussrr", cmds, { language: "fr" })?.name,
                        "pousser",
                    ));
            });
        });
    });
});
