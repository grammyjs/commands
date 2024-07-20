import { SetMyCommandsParams } from "../commands.ts";
import { Api } from "../deps.deno.ts";
import { OffenderBotCommand } from "./errors.ts";

export const isCommandTooLong = (command: string) => command.length > 32;
export const doesCommandContainInvalidChars = (command: string) =>
    !/^[a-z0-9_]+$/.test(command);

const isCommandValid = (command: string) => {
    return !isCommandTooLong(command) &&
        !doesCommandContainInvalidChars(command);
};

/**
 * Options for the `setBotCommands` function.
 */
export interface SetBotCommandsOptions {
    /**
     * Wether to remove invalid commands from the list of calls to the Bot API.
     *
     * If set to `false`, the method will throw an error if any of the commands
     * is invalid according to the {@link https://core.telegram.org/bots/api#botcommand|official Bot API documentation}.
     *
     * Defaults to `false`.
     */
    filterInvalidCommands?: boolean;
}

/**
 * Performs validation and sets the provided commands for the bot.
 * @param api Instance of the Api class for the bot the commands are being set for.
 * @param commandParams List of commands to set.
 * @param options Options object`
 */
export async function setBotCommands(
    api: Api,
    commandParams: SetMyCommandsParams[],
    options?: Partial<SetBotCommandsOptions>,
) {
    const { filterInvalidCommands = false } = options ?? {};

    const invalidCommands = filterInvalidCommands ? [] : commandParams
        .flatMap(({ commands }) => commands)
        .filter((command) =>
            command instanceof OffenderBotCommand
        ) as OffenderBotCommand[];

    const commandErrors = invalidCommands.map((command) => {
        return `${command}: ${command.cause}`;
    });

    if (commandErrors.length) {
        throw new Error(
            [
                "setMyCommands called with commands that would cause an error from the Bot API because they are invalid.",
                "Invalid commands:",
                commandErrors.join("\n"),
            ].join("\n"),
        );
    }

    const validCommandParams = commandParams.map((
        { commands, ...params },
    ) => ({
        ...params,
        commands: commands.filter((command) =>
            !(command instanceof OffenderBotCommand)
        ),
    }));

    await Promise.all(
        validCommandParams.map((args) => api.raw.setMyCommands(args)),
    );
}
