import { Commands } from "../src/commands.ts";
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
            commands.command("test", "default handler", () => {}, {
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
            commands.command("test", "default handler", () => {}, {
                prefix: "test",
            });
            assertEquals(
                (commands as any)._commands[0]._options.prefix,
                "test",
            );
        });
    });
});
