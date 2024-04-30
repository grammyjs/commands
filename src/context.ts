import { Commands } from "./commands.ts";
import { Context, NextFunction } from "./deps.deno.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./jaro-winkler.ts";

export interface CommandsFlavor<C extends Context = Context> extends Context {
    /**
     * Sets the provided commands for the current chat.
     * Cannot be called on updates that don't have a `chat` property.
     *
     * @param commands List of available commands
     * @returns Promise with the result of the operations
     */
    setMyCommands: (commands: Commands<C>, ...rest : Commands <C>[]) => Promise<void>;
    /**
     * Returns the nearest command to the user input.
     * If no command is found, returns `null`.
     *
     * @param commands List of available commands
     * @param options Options for the Jaro-Winkler algorithm
     * @returns The nearest command or `null`
     */
    getNearestCommand: (
        commands: Commands<C>,
        options?: Partial<JaroWinklerOptions>,
    ) => string | null;
}

/**
 * Installs the commands flavor into the context.
 */
export function commands<C extends Context>() {
    return (ctx: CommandsFlavor<C>, next: NextFunction) => {
        ctx.setMyCommands = async (commands, ...moreCommands : Commands<C>[]) => {
            if (!ctx.chat) {
                throw new Error(
                    "cannot call `ctx.setMyCommands` on an update with no `chat` property",
                );
            }

            const commandsMixin = [commands].concat(moreCommands).values()
            for(const commands of commandsMixin){
                await Promise.all(
                    commands
                        .toSingleScopeArgs({ type: "chat", chat_id: ctx.chat.id })
                        .map((args) => ctx.api.raw.setMyCommands(args)),
                );
            }
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
