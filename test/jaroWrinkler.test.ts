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

            assertEquals(fuzzyMatch("strt", cmds, {}), "start");
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
    });
});
