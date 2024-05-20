import { Commands } from "./commands.ts";
import { Context, NextFunction } from "./deps.deno.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./jaro-winkler.ts";
import { SetMyCommandsParams } from "./mod.ts";

export interface CommandsFlavor<C extends Context = Context> extends Context {
    /**
     * Sets the provided commands for the current chat.
     * Cannot be called on updates that don't have a `chat` property.
     *
     * @param commands List of available commands
     * @returns Promise with the result of the operations
     */
    setMyCommands: (
        commands: Commands<C>,
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
            const commandsParams = [commands].concat(moreCommands).map((
                commands,
            ) => commands.toSingleScopeArgs({
                type: "chat",
                chat_id: ctx.chat!.id,
            }));

            const mergedCommands = mergeMyCommandsParams(commandsParams);

            await Promise.all(
                mergedCommands
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
 * Iterates over an array of commands params, merging commands when two commandsParams
 * are from the same language.
 *
 * @param commandParams an array of commands params coming from multiple Commands instances
 * @returns an array containing all commands to be set on ctx
 */

function mergeMyCommandsParams(
    commandParams: SetMyCommandsParams[][],
): SetMyCommandsParams[] {
    if (!commandParams.flat().length) return [];
    return commandParams
        .flat()
        .sort((a, b) => {
            if (!a.language_code) return -1;
            if (!b.language_code) return 1;
            return a.language_code.localeCompare(b.language_code);
        })
        .reduce((result, current, i, arr) => {
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
