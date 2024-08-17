import { SetMyCommandsParams, UncompliantCommand } from "../command-group.ts";
import { Api } from "../deps.deno.ts";
import { UncompliantCommandsError } from "./errors.ts";

/**
 * Options for the `setBotCommands` function.
 */
export interface SetBotCommandsOptions {
  /**
   * Whether to remove invalid commands from the list of calls to the Bot API.
   *
   * If set to `false`, the method will throw an error if any of the commands
   * is invalid according to the {@link https://core.telegram.org/bots/api#botcommand|official Bot API documentation}.
   *
   * Defaults to `false`.
   */
  ignoreUncompliantCommands?: boolean;
}

/**
 * Performs validation and sets the provided commands for the bot.
 * @param api Instance of the Api class for the bot the commands are being set for.
 * @param commandParams List of commands to set.
 * @param uncompliantCommands List of commands that do not comply with the Bot API rules.
 * @param options Options object`
 */
export async function setBotCommands(
  api: Api,
  commandParams: SetMyCommandsParams[],
  uncompliantCommands: UncompliantCommand[],
  options?: Partial<SetBotCommandsOptions>,
) {
  const { ignoreUncompliantCommands = false } = options ?? {};

  if (uncompliantCommands.length && !ignoreUncompliantCommands) {
    throw new UncompliantCommandsError(uncompliantCommands);
  }

  await Promise.all(
    commandParams.map((args) => api.raw.setMyCommands(args)),
  );
}
