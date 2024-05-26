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

            assertEquals(fuzzyMatch("strt", cmds, {})?.name, "start");
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
            assertEquals(fuzzyMatch("magcal", cmds, {})?.name, "magical_\\d");
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
                fuzzyMatch("magici_c", cmds, {language: 'es'})?.name,
                "magico_(c|d)",
            );
            assertEquals(
                fuzzyMatch("magici_a", cmds, {})?.name,
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
        describe('Should return the command localization related to the user lang', () => {
            const cmds = new Commands<Context>();
            cmds.command('duke', 'sniper', () => { })
                .localize('es', 'duque', '_')
                .localize('fr', 'duc', '_')
                .localize('it', 'duca', '_')
                .localize('pt', 'duque', '_')
                .localize('de', 'herzog', '_')
                .localize('sv', 'hertig', '_')
                .localize('da', 'hertug', '_')
                .localize('fi', 'herttua', '_')
                .localize('hu', 'herceg', '_')

            it("sv", () => {
                assertEquals(fuzzyMatch('hertog', cmds, {}), "hertig");
            });
            it("da", () => {
                assertEquals(fuzzyMatch('hertog', cmds, {}), "hertug");
            });
            it("default", () => {
                assertEquals(fuzzyMatch('duk', cmds, {}), "duke");
                assertEquals(fuzzyMatch('duka', cmds, {}), "duke");
                assertEquals(fuzzyMatch('duqa', cmds, {}), "duke");
                assertEquals(fuzzyMatch('duqe', cmds, {}), "duke");
            });
            it("es", () => {
                assertEquals(fuzzyMatch('duk', cmds, {}), "duque");
                assertEquals(fuzzyMatch('duke', cmds, {}), "duque");
                assertEquals(fuzzyMatch('dukue', cmds, {}), "duque");
                assertEquals(fuzzyMatch('duqe', cmds, {}), "duque");
            });
            it("fr", () => {
                assertEquals(fuzzyMatch('duk', cmds, {}), "duc");
                assertEquals(fuzzyMatch('duco', cmds, {}), "duc");
                assertEquals(fuzzyMatch('duca', cmds, {}), "duc");
                assertEquals(fuzzyMatch('ducce', cmds, {}), "duc");
            });
        })
    });
});
