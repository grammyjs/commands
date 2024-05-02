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

    /** */

    setMyCommandsToDefault: () => void;

    /** */

    cleanMyCommands: () => void;
}

/**
 * Installs the commands flavor into the context.
 */
export function commands<C extends Context>(defaultCommands?: Commands<C>) {
    const emptyCommands = new Commands<C>();
    if (!defaultCommands) {
        defaultCommands = emptyCommands;
    }

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
            console.log(commands.toSingleScopeArgs({
                type: "chat",
                chat_id: ctx.chat!.id,
            }))

            // const commandsParams = [commands].concat(moreCommands).map((
            //     commands,
            // ) => commands.toSingleScopeArgs({
            //     type: "chat",
            //     chat_id: ctx.chat!.id,
            // })).flat();

            // console.log(commandsParams)
            // mergeMyCommandsParams(commandsParams)

            await Promise.all(
                commands
                .toSingleScopeArgs({
                    type: "chat",
                    chat_id: ctx.chat!.id,
                })
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

        // ctx.setMyCommandsToDefault = async () => {
        //     await ctx.setMyCommands(defaultCommands);
        // };

        // ctx.cleanMyCommands = async () => {
        //     await ctx.setMyCommands(emptyCommands);
        // };

        return next();
    };
}

function mergeMyCommandsParams(params : SetMyCommandsParams[]) : SetMyCommandsParams[]{
    return params.reduce((acc, next, i)=>{
        if(i === 0) return acc;
        const v = acc.find(({scope,language_code})=>{
           language_code === next.language_code 
        })
        console.log(v)
        // acc.commands = acc.commands.concat(next.commands)
        return acc
    },[params[0]])
}