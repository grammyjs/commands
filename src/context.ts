import { Commands } from "./commands.ts";
import { Context, NextFunction } from "./deps.deno.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./jaro-winkler.ts";

export type CommandsFlavor<C extends Context = Context> = C & {
    /**
     * Sets the provided commands for the current chat.
     * Cannot be called on updates that don't have a `chat` property.
     *
     * @param commands List of available commands
     * @returns Promise with the result of the operations
     */
    setMyCommands: (commands: Commands<C>) => Promise<true[]>;
    getNearestCommand: (
        commands: Commands<C>,
        options?: Partial<JaroWinklerOptions>,
    ) => string | null;
};

export function commands<C extends Context>() {
    return (ctx: CommandsFlavor<C>, next: NextFunction) => {
        ctx.setMyCommands = (commands) => {
            if (!ctx.chat) {
                throw new Error(
                    "cannot call `ctx.setMyCommands` on an update with no `chat` property",
                );
            }

            return Promise.all(
                commands
                    .toSingleScopeArgs({ type: "chat", chat_id: ctx.chat.id })
                    .map((args) => ctx.api.raw.setMyCommands(args)),
            );
        };

        ctx.getNearestCommand = (commands, options) => {
            if (ctx.msg?.text) {
                const userInput = ctx.msg.text.substring(1);
                return fuzzyMatch(userInput, commands, { ...options });
            }
            return null;
        };

        return next();
    };
}
