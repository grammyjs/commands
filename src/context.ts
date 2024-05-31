import { ensureArray } from "./utils.ts";
import { Commands } from "./commands.ts";
import { Context, NextFunction } from "./deps.deno.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./jaro-winkler.ts";
import { SetMyCommandsParams } from "./mod.ts";

export interface CommandsFlavor<C extends Context = Context> extends Context {
    /**
     * Sets the provided commands for the current chat.
     * Cannot be called on updates that don't have a `chat` property.
     *
     * @example
     * ```typescript
     *  bot.hears("sudo", (ctx) =>
     *      ctx.setMyCommands(userCommands, adminCommands));
     *  bot.hears("logout", (ctx) =>
     *      ctx.setMyCommands(userCommands));
     *  bot.hears("example", (ctx) =>
     *      ctx.setMyCommands([aCommands, bCommands, cCommands]));
     * ```
     *
     * @param commands List of available commands
     * @returns Promise with the result of the operations
     */
    setMyCommands: (
        commands: Commands<C> | Commands<C>[],
        ...moreCommands: Commands<C>[]
    ) => Promise<void>;
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
        ctx.setMyCommands = async (
            commands,
            ...moreCommands: Commands<C>[]
        ) => {
            if (!ctx.chat) {
                throw new Error(
                    "cannot call `ctx.setMyCommands` on an update with no `chat` property",
                );
            }
            commands = ensureArray(commands).concat(moreCommands);
            const commandsParams = commands.map((
                commands,
            ) => commands.toSingleScopeArgs({
                type: "chat",
                chat_id: ctx.chat!.id,
            }));

            await Promise.all(
                MyCommandParams.mergeFrom(commandsParams)
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

/**
 * Static class for manipulating {@link SetMyCommandsParams} coming from {@link Commands.toSingleScopeArgs}
 */
class MyCommandParams {
    /**
     * Merges {@link SetMyCommandsParams} coming from one or more Commands instances
     * into a single one. If only one source it's provided it will remain the same.
     *
     * @param commandsParams setMyCommandsParams coming from one or more Commands instances.
     * @returns an array of SetCommandParams grouped by language
     */
    static mergeFrom(commandsParams: SetMyCommandsParams[][]) {
        if (!commandsParams.flat().length) return [];
        return this.mergeByLanguage(commandsParams.flat());
    }

    /**
     * Lexicographically sorts commandParams based on their language code.
     * @returns the sorted array
     */

    static sortByLanguage(params: SetMyCommandsParams[]) {
        return params.sort((a, b) => {
            if (!a.language_code) return -1;
            if (!b.language_code) return 1;
            return a.language_code.localeCompare(b.language_code);
        });
    }

    /**
     * Iterates over an array of CommandsParams
     * merging their respective {@link SetMyCommandsParams.commands}
     * when they are from the same language, separating when they are not.
     * 
     * @param params a flattened array of commands params coming from one or more Commands instances
     * @returns an array containing all commands grouped by language
     */

    static mergeByLanguage(params: SetMyCommandsParams[]) {
        const sorted = this.sortByLanguage(params);
        return sorted.reduce((result, current, i, arr) => {
            if (i === 0 || current.language_code !== arr[i - 1].language_code) {
                result.push(current);
                return result;
            } else {
                result[result.length - 1].commands = result[result.length - 1]
                    .commands
                    .concat(current.commands);
                return result;
            }
        }, [] as SetMyCommandsParams[]);
    }
}
