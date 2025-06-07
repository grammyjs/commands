import { CHAR_UNDERSCORE } from "https://deno.land/std@0.211.0/path/_common/constants.ts";
import { CommandGroup } from "./command-group.ts";
import { CommandMatch } from "./command.ts";
import { BotCommandScope, BotCommandScopeChat, Context, NextFunction } from "./deps.deno.ts";
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

  /**
   * The matched command and the rest of the input.
   *
   * When matched command is a RegExp, a `match` property exposes the result of the RegExp match.
   */
  commandMatch: CommandMatch;
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

      return result.command.prefix + result.command.command;
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

type scopeLangTupleStr = `${BotCommandScope["type"]},${SetMyCommandsParams["language_code"]}`

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
    const serializedCommands = commands.map((cmds) => cmds.toArgs(chat_id))

    const commandsParams = serializedCommands
      .map(({ scopes }) => scopes)
      .flat();

    const uncompliantCommands = serializedCommands
      .map(({ uncompliantCommands }) => uncompliantCommands)
      .flat();

    return {
      commandsParams: this.merge(commandsParams),
      uncompliantCommands,
    };
  }

  /**
   * Iterates over an array of CommandsParams
   * merging their respective {@link SetMyCommandsParams.commands}
   * when they are from the same language and scope
   *
   * @param params a flattened array of commands params coming from one or more Commands instances
   * @returns an array containing all commands grouped by language
   */

  private static merge(params: SetMyCommandsParams[]) {
    if (!params.length) return [];
    const map = new Map<scopeLangTupleStr, SetMyCommandsParams>()

    params.forEach((curr) => {
      if(!curr.scope) return;
      const key : scopeLangTupleStr = `${curr.scope.type},${curr.language_code}`
      const old = map.get(key)
      if(old){
        curr.commands = curr.commands.concat(old.commands)
      }
      map.set(key,curr)
    })
    
    return map.values().toArray()
  }
}
