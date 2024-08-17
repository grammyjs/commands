import { CommandGroup } from "./command-group.ts";
import { BotCommandScopeChat, Context, NextFunction } from "./deps.deno.ts";
import { SetMyCommandsParams } from "./mod.ts";
import { BotCommandEntity } from "./types.ts";
import { ensureArray, getCommandsRegex } from "./utils/array.ts";
import { fuzzyMatch, JaroWinklerOptions } from "./utils/jaro-winkler.ts";
import {
  setBotCommands,
  SetBotCommandsOptions,
} from "./utils/set-bot-commands.ts";

export interface CommandsFlavor<C extends Context = Context> extends Context {
  /**
   * Sets the provided commands for the current chat.
   * Cannot be called on updates that don't have a `chat` property.
   *
   * [!IMPORTANT]
   * Calling this method with upperCased command names registered, will throw
   * @see https://core.telegram.org/bots/api#botcommand
   * @see https://core.telegram.org/method/bots.setBotCommands
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
    commands: CommandGroup<C> | CommandGroup<C>[],
    options?: SetBotCommandsOptions,
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
    commands: CommandGroup<C> | CommandGroup<C>[],
    options?: Omit<Partial<JaroWinklerOptions>, "language">,
  ) => string | null;

  /**
   * @param commands
   * @returns command entities hydrated with the custom prefixes
   */
  getCommandEntities: (
    commands: CommandGroup<C> | CommandGroup<C>[],
  ) => BotCommandEntity[];
}

/**
 * Installs the commands flavor into the context.
 */
export function commands<C extends Context>() {
  return (ctx: CommandsFlavor<C>, next: NextFunction) => {
    ctx.setMyCommands = async (
      commands,
      options,
    ) => {
      if (!ctx.chat) {
        throw new Error(
          "cannot call `ctx.setMyCommands` on an update with no `chat` property",
        );
      }

      const {
        uncompliantCommands,
        commandsParams: currentChatCommandParams,
      } = MyCommandParams.from(
        ensureArray(commands),
        ctx.chat.id,
      );

      await setBotCommands(
        ctx.api,
        currentChatCommandParams,
        uncompliantCommands,
        options,
      );
    };

    ctx.getNearestCommand = (commands, options) => {
      if (!ctx.has(":text")) {
        throw new Error(
          "cannot call `ctx.getNearestCommand` on an update with no `text`",
        );
      }

      const results = ensureArray(commands)
        .map((commands) => {
          const firstMatch = ctx.getCommandEntities(commands)[0];
          const commandLike = firstMatch?.text.replace(firstMatch.prefix, "") ||
            "";
          const result = fuzzyMatch(commandLike, commands, {
            ...options,
            language: !options?.ignoreLocalization
              ? ctx.from?.language_code
              : undefined,
          });
          return result;
        }).sort((a, b) => (b?.similarity ?? 0) - (a?.similarity ?? 0));

      const result = results[0];

      if (!result || !result.command) return null;

      return result.command.prefix + result.command.name;
    };

    ctx.getCommandEntities = (
      commands: CommandGroup<C> | CommandGroup<C>[],
    ) => {
      if (!ctx.has(":text")) {
        throw new Error(
          "cannot call `ctx.commandEntities` on an update with no `text`",
        );
      }
      const text = ctx.msg.text;
      if (!text) return [];
      const prefixes = ensureArray(commands).flatMap((cmds) => cmds.prefixes);

      if (!prefixes.length) return [];

      const regexes = prefixes.map(
        (prefix) => getCommandsRegex(prefix),
      );
      const entities = regexes.flatMap((regex) => {
        let match: RegExpExecArray | null;
        const matches = [];
        while ((match = regex.exec(text)) !== null) {
          const text = match[0].trim();
          matches.push({
            text,
            offset: match.index,
            prefix: match.groups!.prefix,
            type: "bot_command",
            length: text.length,
          });
        }
        return matches as BotCommandEntity[];
      });

      return entities;
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
        const adminCommands = new CommandGroup();
        const userCommands = new CommandGroup();
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
    commands: CommandGroup<C>[],
    chat_id: BotCommandScopeChat["chat_id"],
  ) {
    const serializedCommands = this._serialize(commands, chat_id);
    const commandsParams = serializedCommands
      .map(({ commandParams }) => commandParams)
      .flat();

    const uncompliantCommands = serializedCommands
      .map(({ uncompliantCommands }) => uncompliantCommands)
      .flat();

    return {
      commandsParams: this.mergeByLanguage(commandsParams),
      uncompliantCommands,
    };
  }

  /**
     * Serializes one or multiple {@link CommandGroup} instances, each one into their respective
     * single scoped SetMyCommandsParams version.
     * @example
        ```ts
        const adminCommands = new CommandGroup();
        // add to scope, localize, etc
        const userCommands = new CommandGroup();
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
    commandsArr: CommandGroup<C>[],
    chat_id: BotCommandScopeChat["chat_id"],
  ) {
    return commandsArr.map((
      commands,
    ) =>
      commands.toSingleScopeArgs({
        type: "chat",
        chat_id,
      })
    );
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
    if (!params.length) return [];
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
