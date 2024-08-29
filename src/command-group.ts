import { Command, CommandsFlavor } from "./mod.ts";
import {
  Api,
  BotCommand,
  BotCommandScope,
  CommandContext,
  Composer,
  Context,
  type LanguageCode,
  Middleware,
} from "./deps.deno.ts";
import type { CommandElementals, CommandOptions } from "./types.ts";
import {
  ensureArray,
  getCommandsRegex,
  type MaybeArray,
} from "./utils/array.ts";
import {
  setBotCommands,
  SetBotCommandsOptions,
} from "./utils/set-bot-commands.ts";
import { JaroWinklerOptions } from "./utils/jaro-winkler.ts";
import { isCommandOptions, isMiddleware } from "./utils/checks.ts";

/**
 * Interface for grouping {@link BotCommand}s that might (or not)
 * be related to each other by scope and/or language.
 */
export interface SetMyCommandsParams {
  /** If defined: scope on which the commands will take effect */
  scope?: BotCommandScope;
  /** If defined: Language on which the commands will take effect.
   * Two letter abbreviation in ISO_639 standard: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
   */
  language_code?: LanguageCode;
  /** Commands that can be each one passed to a SetMyCommands Call */
  commands: BotCommand[];
}

/**
 * Interface to represent uncompliance of a command
 * with the Bot API
 */
export interface UncompliantCommand {
  /** Name of the uncompliant command */
  name: string;
  /** Reason why the command was considered uncompliant */
  reasons: string[];
  /** Language in which the command is uncompliant */
  language: LanguageCode | "default";
}

/**
 * Central class that manages all registered commands.
 * This is the starting point for the plugin, and this is what you should pass to `bot.use` so your commands get properly registered.
 *
 * @example
 * ```typescript
 * const myCommands = new CommandGroup()
 * commands.command("start", "start the bot configuration", (ctx) => ctx.reply("Hello there!"))
 *
 * // Registers the commands with the bot instance.
 * bot.use(myCommands)
 * ```
 */
export class CommandGroup<C extends Context> {
  private _languages: Set<LanguageCode | "default"> = new Set();
  private _scopes: Map<string, Array<Command<C>>> = new Map();
  private _commands: Command<C>[] = [];

  private _cachedComposer: Composer<C> = new Composer();
  private _cachedComposerInvalidated: boolean = false;

  private _commandOptions: Partial<CommandOptions> = {};

  constructor(options: Partial<CommandOptions> = {}) {
    this._commandOptions = options;
    if (this._commandOptions.prefix?.trim() === "") {
      this._commandOptions.prefix = "/";
    }
  }

  private _addCommandToScope(scope: BotCommandScope, command: Command<C>) {
    const commands = this._scopes.get(JSON.stringify(scope)) ?? [];
    this._scopes.set(JSON.stringify(scope), commands.concat([command]));
  }

  private _populateMetadata() {
    this._languages.clear();
    this._scopes.clear();

    this._commands.forEach((command) => {
      for (const scope of command.scopes) {
        this._addCommandToScope(scope, command);
      }

      for (const language of command.languages.keys()) {
        this._languages.add(language);
      }
    });
  }

  /**
   * Registers a new command with a default handler.
   * @param name Default command name
   * @param description Default command description
   * @param handler Default command handler
   * @param options Extra options that should apply only to this command
   * @returns An instance of the `Command` class
   */
  public command(
    name: string | RegExp,
    description: string,
    handler: MaybeArray<Middleware<CommandContext<C>>>,
    options?: Partial<CommandOptions>,
  ): Command<C>;
  /**
   * Registers a new command with no handlers.
   * @param name Default command name
   * @param description Default command description
   * @param options Extra options that should apply only to this command
   * @returns An instance of the `Command` class
   */
  public command(
    name: string | RegExp,
    description: string,
    options?: Partial<CommandOptions>,
  ): Command<C>;
  public command(
    name: string | RegExp,
    description: string,
    handlerOrOptions?:
      | MaybeArray<Middleware<CommandContext<C>>>
      | Partial<CommandOptions>,
    _options?: Partial<CommandOptions>,
  ) {
    const handler = isMiddleware(handlerOrOptions)
      ? handlerOrOptions
      : undefined;

    const options = !handler && isCommandOptions(handlerOrOptions)
      ? { ...this._commandOptions, ...handlerOrOptions }
      : { ...this._commandOptions, ..._options };

    const command = new Command<C>(name, description, handler, options);

    this._commands.push(command);
    this._cachedComposerInvalidated = true;

    return command;
  }

  /**
   * Registers a Command that was created by it's own.
   *
   * @param command the command or list of commands being added to the group
   */
  public add(command: Command<C> | Command<C>[]) {
    this._commands.push(...ensureArray(command));
    this._cachedComposerInvalidated = true;
    return this;
  }

  /**
   * Serializes the commands into multiple objects that can each be passed to a `setMyCommands` call.
   *
   * @returns One item for each combination of command + scope + language
   */
  public toArgs() {
    this._populateMetadata();
    const scopes: SetMyCommandsParams[] = [];
    const uncompliantCommands: UncompliantCommand[] = [];

    for (const [scope, commands] of this._scopes.entries()) {
      for (const language of this._languages) {
        const compliantScopedCommands: Command<C>[] = [];

        commands.forEach((command) => {
          const [isApiCompliant, ...reasons] = command.isApiCompliant(
            language,
          );

          if (isApiCompliant) {
            return compliantScopedCommands.push(command);
          }

          uncompliantCommands.push({
            name: command.stringName,
            reasons: reasons,
            language,
          });
        });

        if (compliantScopedCommands.length) {
          scopes.push({
            scope: JSON.parse(scope),
            language_code: language === "default" ? undefined : language,
            commands: compliantScopedCommands.map((command) =>
              command.toObject(language)
            ),
          });
        }
      }
    }

    return {
      scopes,
      uncompliantCommands,
    };
  }

  /**
   * Serializes the commands of a single scope into objects that can each be passed to a `setMyCommands` call.
   *
   * @param scope Selected scope to be serialized
   * @returns One item per command per language
   */
  public toSingleScopeArgs(
    scope: BotCommandScope,
  ) {
    this._populateMetadata();

    const commandParams: SetMyCommandsParams[] = [];

    const uncompliantCommands: UncompliantCommand[] = [];
    for (const language of this._languages) {
      const compliantCommands: Command<C>[] = [];

      this._commands.forEach((command) => {
        const [isApiCompliant, ...reasons] = command.isApiCompliant(
          language,
        );

        if (!isApiCompliant) {
          return uncompliantCommands.push({
            name: command.stringName,
            reasons: reasons,
            language,
          });
        }

        if (command.scopes.length) compliantCommands.push(command);
      });

      commandParams.push({
        scope,
        language_code: language === "default" ? undefined : language,
        commands: compliantCommands.map((command) =>
          command.toObject(language)
        ),
      });
    }

    return { commandParams, uncompliantCommands };
  }

  /**
   * Registers all commands to be displayed by clients according to their scopes and languages
   * Calls `setMyCommands` for each language of each scope of each command.
   *
   * [!IMPORTANT]
   * Calling this method with upperCased command names registered, will throw
   * @see https://core.telegram.org/bots/api#botcommand
   * @see https://core.telegram.org/method/bots.setBotCommands
   *
   * @param Instance of `bot` or { api: bot.api }
   */
  public async setCommands(
    { api }: { api: Api },
    options?: Partial<SetBotCommandsOptions>,
  ) {
    const { scopes, uncompliantCommands } = this.toArgs();

    await setBotCommands(api, scopes, uncompliantCommands, options);
  }

  /**
   * Serialize all register commands into it's name, prefix and language
   *
   * @param filterLanguage if undefined, it returns all names
   * else get only the locales for the given filterLanguage
   * fallbacks to "default"
   *
   * @returns an array of {@link CommandElementals}
   *
   * Note: mainly used to serialize for {@link FuzzyMatch}
   */

  public toElementals(
    filterLanguage?: LanguageCode | "default",
  ): CommandElementals[] {
    this._populateMetadata();

    return Array.from(this._scopes.values())
      .flat()
      .flatMap(
        (command) => {
          const elements = [];
          for (
            const [language, local] of command.languages.entries()
          ) {
            elements.push({
              name: local.name instanceof RegExp
                ? local.name.source
                : local.name,
              language,
              prefix: command.prefix,
              scopes: command.scopes,
              description: command.getLocalizedDescription(
                language,
              ),
            });
          }
          if (filterLanguage) {
            const filtered = elements.filter((command) =>
              command.language === filterLanguage
            );
            const defaulted = elements.filter((command) =>
              command.language === "default"
            );
            return filtered.length ? filtered[0] : defaulted[0];
          } else return elements;
        },
      );
  }

  /**
   * @returns A JSON serialized version of all the currently registered commands
   */
  public toString() {
    return JSON.stringify(this);
  }

  middleware() {
    if (this._cachedComposerInvalidated) {
      this._cachedComposer = new Composer(...this._commands);
      this._cachedComposerInvalidated = false;
    }
    return this._cachedComposer.middleware();
  }

  /**
   * @returns all {@link Command}s contained in the instance
   */
  public get commands(): Command<C>[] {
    return this._commands;
  }

  /**
   * @returns all prefixes registered in this instance
   */
  public get prefixes(): string[] {
    return [
      ...new Set(this._commands.flatMap((command) => command.prefix)),
    ];
  }

  /**
   * Replaces the `toString` method on Deno
   *
   * @see toString
   */
  [Symbol.for("Deno.customInspect")]() {
    return this.toString();
  }

  /**
   * Replaces the `toString` method on Node.js
   *
   * @see toString
   */
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}

type HaveCommandLike<
  C extends Context = Context,
  CF extends CommandsFlavor<C> = CommandsFlavor<C>,
> = C & CF & {
  commandSuggestion: string | null;
};

export function commandNotFound<
  CF extends CommandsFlavor<C>,
  C extends Context = Context,
>(
  commands: CommandGroup<C> | CommandGroup<C>[],
  opts: Omit<Partial<JaroWinklerOptions>, "language"> = {},
) {
  return function (
    ctx: C,
  ): ctx is HaveCommandLike<C, CF> {
    if (containsCommands(ctx, commands)) {
      (ctx as HaveCommandLike<C, CF>)
        .commandSuggestion = (ctx as HaveCommandLike<C, CF>)
          .getNearestCommand(commands, opts);
      return true;
    }
    return false;
  };
}

function containsCommands<
  C extends Context,
>(
  ctx: C,
  commands: CommandGroup<C> | CommandGroup<C>[],
) {
  let allPrefixes = [
    ...new Set(
      ensureArray(commands).flatMap((cmds) => cmds.prefixes),
    ),
  ];
  if (allPrefixes.length < 1) {
    allPrefixes = ["/"];
  }

  for (const prefix of allPrefixes) {
    const regex = getCommandsRegex(prefix);
    if (ctx.hasText(regex)) return true;
  }
  return false;
}
