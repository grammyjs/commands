import { Commands } from "./commands.ts";
import { BotCommandScopeChat, Context, NextFunction } from "./deps.deno.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./jaro-winkler.ts";
import { SetMyCommandsParams } from "./mod.ts";
import { ensureArray } from "./utils.ts";

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
        commands: Commands<C> | Commands<C>[],
        options?: Omit<Partial<JaroWinklerOptions>, "language">,
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

            await Promise.all(
                MyCommandParams.from(commands, ctx.chat.id)
                    .map((args) => ctx.api.raw.setMyCommands(args)),
            );
        };

        ctx.getNearestCommand = (commands, options) => {
            if (ctx.msg?.text) {
                commands = ensureArray(commands);
                const results = commands.map((commands) => {
                    const userInput = ctx.msg!.text!.substring(1);
                    const result = fuzzyMatch(userInput, commands, {
                        ...options,
                        language: options?.ignoreLocalization
                            ? undefined
                            : ctx.from?.language_code
                            ? ctx.from.language_code
                            : undefined,
                    });
                    return result;
                }).sort((a, b) => (b?.similarity ?? 0) - (a?.similarity ?? 0));
                const result = results[0];
                if (!result || !result.command) return null;

                return result.command.prefix + result.command.name;
            }
            return null;
        };

        return next();
    };
}

/**
 * Static class for getting and manipulating {@link SetMyCommandsParams}.
 * The main function is {@link from}
 */
export class MyCommandParams {
    /**
     * Merges and serialize one or more Commands instances into a single array
     * of commands params that can be used to set the commands menu displayed to the user.
     * @example
        ```ts
        const adminCommands = new Commands();
        const userCommands = new Commands();
        adminCommands
            .command("do a",
                     "a description",
                     (ctx) => ctx.doA());
        userCommands
            .command("do b",
                     "b description",
                     (ctx) => ctx.doB());
        const mergedParams = 
            MyCommandParams.from([a, b], someChatId);
        ```
     * @param commands An array of one or more Commands instances.
     * @returns an array of {@link SetMyCommandsParams} grouped by language
     */
    static from<C extends Context>(
        commands: Commands<C>[],
        chat_id: BotCommandScopeChat["chat_id"],
    ) {
        const commandsParams = this._serialize(commands, chat_id).flat();
        if (!commandsParams.length) return [];
        return this.mergeByLanguage(commandsParams);
    }

    /**
     * Serializes one or multiple {@link Commands} instances, each one into their respective
     * single scoped SetMyCommandsParams version.
     * @example
        ```ts
        const adminCommands = new Commands();
        // add to scope, localize, etc
        const userCommands = new Commands();
        // add to scope, localize, etc
        const [
            singleScopedAdminParams,
            singleScopedUserParams
        ] = MyCommandsParams.serialize([adminCommands,userCommands])
        ```
     * @param commandsArr an array of one or more commands instances
     * @param chat_id the chat id relative to the message update, coming from the ctx object.
     * @returns an array of scoped {@link SetMyCommandsParams} mapped from their respective Commands instances
     */
    static _serialize<C extends Context>(
        commandsArr: Commands<C>[],
        chat_id: BotCommandScopeChat["chat_id"],
    ) {
        return commandsArr.map((
            commands,
        ) => commands.toSingleScopeArgs({
            type: "chat",
            chat_id,
        }));
    }

    /**
     * Lexicographically sorts commandParams based on their language code.
     * @returns the sorted array
     */

    static _sortByLanguage(params: SetMyCommandsParams[]) {
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

    private static mergeByLanguage(params: SetMyCommandsParams[]) {
        const sorted = this._sortByLanguage(params);
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
