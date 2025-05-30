import { CommandsFlavor } from "./context.ts";
import {
  type BotCommandScope,
  type BotCommandScopeAllChatAdministrators,
  type BotCommandScopeAllGroupChats,
  type BotCommandScopeAllPrivateChats,
  type ChatTypeMiddleware,
  CommandContext,
  Composer,
  type Context,
  type LanguageCode,
  type Middleware,
  type MiddlewareObj,
  type NextFunction,
} from "./deps.deno.ts";
import type { BotCommandX, CommandOptions } from "./types.ts";
import { ensureArray, type MaybeArray } from "./utils/array.ts";
import {
  isAdmin,
  isCommandOptions,
  isMiddleware,
  matchesPattern,
} from "./utils/checks.ts";
import { InvalidScopeError } from "./utils/errors.ts";

type BotCommandGroupsScope =
  | BotCommandScopeAllGroupChats
  | BotCommandScopeAllChatAdministrators;

type ScopeHandlerTuple<C extends Context> = [
  CommandOptions,
  Middleware<C>[] | undefined,
];

/**
 * Represents a matched command, the result of the RegExp match, and the rest of the input.
 */
export interface CommandMatch {
  /**
   * The matched command.
   */
  command: string | RegExp;
  /**
   * The rest of the input after the command.
   */
  rest: string;
  /**
   * The result of the RegExp match.
   *
   * Only defined if the command is a RegExp.
   */
  match?: RegExpExecArray | null;
}

const NOCASE_COMMAND_NAME_REGEX = /^[0-9a-z_]+$/i;

/**
 * Class that represents a single command and allows you to configure it.
 */
export class Command<C extends Context = Context> implements MiddlewareObj<C> {
  private _scopes: BotCommandScope[] = [];
  private _languages: Map<
    LanguageCode | "default",
    { name: string | RegExp; description: string }
  > = new Map();
  private _defaultScopeComposer = new Composer<C>();
  private _options: CommandOptions = {
    prefix: "/",
    matchOnlyAtStart: true,
    targetedCommands: "optional",
    ignoreCase: false,
  };

  private _scopeHandlers = new Map<
    BotCommandScope,
    ScopeHandlerTuple<C>
  >();
  private _cachedComposer: Composer<C> = new Composer<C>();
  private _cachedComposerInvalidated: boolean = false;
  private _hasHandler: boolean;

  /**
   * Initialize a new command with a default handler.
   *
   * [!IMPORTANT] This class by its own does nothing. It needs to be imported into a `CommandGroup`
   * via the `add` method.
   *
   * @example
   * ```ts
   *    const sayHi = new Command("hi","say hi", (ctx) => ctx.reply("hi"))
   *    const myCmds = new CommandGroup().add(sayHi)
   * ```
   *
   * @param name Default command name
   * @param description Default command description
   * @param handler Default command handler
   * @param options Extra options that should apply only to this command
   * @returns An instance of the `Command` class
   */

  constructor(
    name: string | RegExp,
    description: string,
    handler: MaybeArray<Middleware<CommandContext<C>>>,
    options?: Partial<CommandOptions>,
  );
  /**
   * Initialize a new command with no handlers.
   *
   * [!IMPORTANT] This class by its own does nothing. It needs to be imported into a `CommandGroup`
   * via the `add` method
   *
   * @example
   * ```ts
   *    const sayHi = new Command("hi","say hi", (ctx) => ctx.reply("hi") )
   *    const myCmds = new CommandGroup().add(sayHi)
   * ```
   *
   * @param name Default command name
   * @param description Default command description
   * @param options Extra options that should apply only to this command
   * @returns An instance of the `Command` class
   */
  constructor(
    name: string | RegExp,
    description: string,
    options?: Partial<CommandOptions>,
  );
  constructor(
    name: string | RegExp,
    description: string,
    handlerOrOptions?:
      | MaybeArray<Middleware<CommandContext<C>>>
      | Partial<CommandOptions>,
    options?: Partial<CommandOptions>,
  );
  constructor(
    name: string | RegExp,
    description: string,
    handlerOrOptions?:
      | MaybeArray<Middleware<CommandContext<C>>>
      | Partial<CommandOptions>,
    options?: Partial<CommandOptions>,
  ) {
    let handler = isMiddleware(handlerOrOptions) ? handlerOrOptions : undefined;

    options = !handler && isCommandOptions(handlerOrOptions)
      ? handlerOrOptions
      : options;

    if (!handler) {
      handler = async (_ctx: Context, next: NextFunction) => await next();
      this._hasHandler = false;
    } else this._hasHandler = true;

    this._options = { ...this._options, ...options };
    if (this._options.prefix?.trim() === "") this._options.prefix = "/";
    this._languages.set("default", { name: name, description });
    if (handler) {
      this.addToScope({ type: "default" }, handler);
    }
    return this;
  }

  /**
   * Whether the command has a custom prefix
   */
  get hasCustomPrefix() {
    return this.prefix && this.prefix !== "/";
  }

  /**
   * Gets the command name as string
   */
  public get stringName() {
    return typeof this.name === "string" ? this.name : this.name.source;
  }

  /**
   * Whether the command can be passed to a `setMyCommands` API call
   * and, if not, the reason.
   */
  public isApiCompliant(
    language?: LanguageCode | "default",
  ): [result: true] | [
    result: false,
    ...reasons: string[],
  ] {
    const problems: string[] = [];

    if (this.hasCustomPrefix) {
      problems.push(`Command has custom prefix: ${this._options.prefix}`);
    }

    const name = language ? this.getLocalizedName(language) : this.name;

    if (typeof name !== "string") {
      problems.push("Command has a regular expression name");
    }

    if (typeof name === "string") {
      if (name.toLowerCase() !== name) {
        problems.push("Command name has uppercase characters");
      }

      if (name.length > 32) {
        problems.push(
          `Command name is too long (${name.length} characters). Maximum allowed is 32 characters`,
        );
      }

      if (!NOCASE_COMMAND_NAME_REGEX.test(name)) {
        problems.push(
          `Command name has special characters (${
            name.replace(/[0-9a-z_]/ig, "")
          }). Only letters, digits and _ are allowed`,
        );
      }
    }

    return problems.length ? [false, ...problems] : [true];
  }

  /**
   * Get registered scopes for this command
   */
  get scopes() {
    return this._scopes;
  }

  /**
   * Get registered languages for this command
   */
  get languages() {
    return this._languages;
  }

  /**
   * Get registered names for this command
   */
  get names() {
    return Array.from(this._languages.values()).map(({ name }) => name);
  }

  /**
   * Get the default name for this command
   */
  get name() {
    return this._languages.get("default")!.name;
  }

  /**
   * Get the default description for this command
   */
  get description() {
    return this._languages.get("default")!.description;
  }

  /**
   * Get the prefix for this command
   */
  get prefix() {
    return this._options.prefix;
  }

  /**
   * Get if this command has a handler
   */
  get hasHandler(): boolean {
    return this._hasHandler;
  }

  /**
   * Registers the command to a scope to allow it to be handled and used with `setMyCommands`.
   * This will automatically apply filtering middlewares for you, so the handler only runs on the specified scope.
   *
   * @example
   * ```ts
   * const myCommands = new CommandGroup();
   * myCommands.command("start", "Initializes bot configuration")
   *     .addToScope(
   *         { type: "all_private_chats" },
   *         (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
   *     )
   *     .addToScope(
   *         { type: "all_group_chats" },
   *         (ctx) => ctx.reply(`Hello, members of ${ctx.chat.title}!`),
   *     );
   * ```
   *
   * @param scope Which scope this command should be available on
   * @param middleware The handler for this command on the specified scope
   * @param options Additional options that should apply only to this scope
   */
  public addToScope(
    scope: BotCommandGroupsScope,
    middleware?: MaybeArray<ChatTypeMiddleware<C, "group" | "supergroup">>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScopeAllPrivateChats,
    middleware?: MaybeArray<ChatTypeMiddleware<C, "private">>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScope,
    middleware?: MaybeArray<Middleware<C>>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScope,
    middleware?: MaybeArray<Middleware<C>>,
    options: Partial<CommandOptions> = this._options,
  ): this {
    const middlewareArray = middleware ? ensureArray(middleware) : undefined;
    const optionsObject = { ...this._options, ...options };

    this._scopes.push(scope);
    if (middlewareArray && middlewareArray.length) {
      this._scopeHandlers.set(scope, [optionsObject, middlewareArray]);
      this._cachedComposerInvalidated = true;
    }

    return this;
  }

  /**
   * Finds the matching command in the given context
   *
   * @example
   * ```ts
   * // ctx.msg.text = "/delete_123 something"
   * const match = Command.findMatchingCommand(/delete_(.*)/, { prefix: "/", ignoreCase: true }, ctx)
   * // match is { command: /delete_(.*)/, rest: ["something"], match: ["delete_123"] }
   * ```
   */
  public static findMatchingCommand(
    command: MaybeArray<string | RegExp>,
    options: CommandOptions,
    ctx: Context,
  ): CommandMatch | null {
    const { matchOnlyAtStart, prefix, targetedCommands } = options;

    if (!ctx.has([":text", ":caption"])) return null;
    const txt = ctx.msg.text ?? ctx.msg.caption;

    if (matchOnlyAtStart && !txt.startsWith(prefix)) {
      return null;
    }

    const commandNames = ensureArray(command);
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const commandRegex = new RegExp(
      `${escapedPrefix}(?<command>[^@ ]+)(?:@(?<username>[^\\s]*))?(?<rest>.*)`,
      "g",
    );

    const firstCommand = commandRegex.exec(txt)?.groups;

    if (!firstCommand) return null;

    if (!firstCommand.username && targetedCommands === "required") return null;
    if (firstCommand.username && firstCommand.username !== ctx.me.username) {
      return null;
    }
    if (firstCommand.username && targetedCommands === "ignored") return null;

    const matchingCommand = commandNames.find((name) => {
      const matches = matchesPattern(
        name instanceof RegExp
          ? firstCommand.command + firstCommand.rest
          : firstCommand.command,
        name,
        options.ignoreCase,
      );
      return matches;
    });

    if (matchingCommand instanceof RegExp) {
      return {
        command: matchingCommand,
        rest: firstCommand.rest.trim(),
        match: matchingCommand.exec(txt),
      };
    }

    if (matchingCommand) {
      return {
        command: matchingCommand,
        rest: firstCommand.rest.trim(),
      };
    }

    return null;
  }

  /**
   * Creates a matcher for the given command that can be used in filtering operations
   *
   * @example
   * ```ts
   * bot
   *  .filter(
   *    Command.hasCommand(/delete_(.*)/),
   *    (ctx) => ctx.reply(`Deleting ${ctx.message?.text?.split("_")[1]}`)
   *  )
   * ```
   *
   * @param command Command name or RegEx
   * @param options Options that should apply to the matching algorithm
   * @returns A predicate that matches the given command
   */
  public static hasCommand(
    command: MaybeArray<string | RegExp>,
    options: CommandOptions,
  ) {
    return (ctx: Context) => {
      const matchingCommand = Command.findMatchingCommand(
        command,
        options,
        ctx,
      );

      if (!matchingCommand) return false;

      ctx.match = matchingCommand.rest;
      // TODO: Clean this up. But how to do it without requiring the user to install the commands flavor?
      (ctx as Context & CommandsFlavor).commandMatch = matchingCommand;

      return true;
    };
  }

  /**
   * Adds a new translation for the command
   *
   * @example
   * ```ts
   * myCommands
   *  .command("start", "Starts the bot configuration")
   *  .localize("pt", "iniciar", "Inicia a configuração do bot")
   * ```
   *
   * @param languageCode Language this translation applies to. @see https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
   * @param name Localized command name
   * @param description Localized command description
   */
  public localize(
    languageCode: LanguageCode,
    name: string | RegExp,
    description: string,
  ) {
    this._languages.set(languageCode, {
      name: name,
      description,
    });
    this._cachedComposerInvalidated = true;
    return this;
  }

  /**
   * Gets the localized command name of an existing translation
   * @param languageCode Language to get the name for
   * @returns Localized command name
   */
  public getLocalizedName(languageCode: LanguageCode | "default") {
    return this._languages.get(languageCode)?.name ?? this.name;
  }

  /**
   * Gets the localized command name of an existing translation
   * @param languageCode Language to get the name for
   * @returns Localized command name
   */
  public getLocalizedDescription(languageCode: LanguageCode | "default") {
    return this._languages.get(languageCode)?.description ??
      this.description;
  }

  /**
   * Converts command to an object representation.
   * Useful for JSON serialization.
   *
   * @param languageCode If specified, uses localized versions of the command name and description
   * @returns Object representation of this command
   */
  public toObject(
    languageCode: LanguageCode | "default" = "default",
  ): Pick<BotCommandX, "command" | "description" | "hasHandler"> {
    const localizedName = this.getLocalizedName(languageCode);
    return {
      command: localizedName instanceof RegExp
        ? localizedName.source
        : localizedName,
      description: this.getLocalizedDescription(languageCode),
      ...(this.hasHandler ? { hasHandler: true } : { hasHandler: false }),
    };
  }

  private registerScopeHandlers() {
    const entries = this._scopeHandlers.entries();

    for (const [scope, [optionsObject, middlewareArray]] of entries) {
      if (middlewareArray) {
        switch (scope.type) {
          case "default":
            this._defaultScopeComposer
              .filter(Command.hasCommand(this.names, optionsObject))
              .use(...middlewareArray);
            break;
          case "all_chat_administrators":
            this._cachedComposer
              .filter(Command.hasCommand(this.names, optionsObject))
              .chatType(["group", "supergroup"])
              .filter(isAdmin)
              .use(...middlewareArray);
            break;
          case "all_private_chats":
            this._cachedComposer
              .filter(Command.hasCommand(this.names, optionsObject))
              .chatType("private")
              .use(...middlewareArray);
            break;
          case "all_group_chats":
            this._cachedComposer
              .filter(Command.hasCommand(this.names, optionsObject))
              .chatType(["group", "supergroup"])
              .use(...middlewareArray);
            break;
          case "chat":
            if (scope.chat_id) {
              this._cachedComposer
                .filter(Command.hasCommand(this.names, optionsObject))
                .chatType(["group", "supergroup", "private"])
                .filter((ctx) => ctx.chatId === scope.chat_id)
                .use(...middlewareArray);
            }
            break;
          case "chat_administrators":
            if (scope.chat_id) {
              this._cachedComposer
                .filter(Command.hasCommand(this.names, optionsObject))
                .chatType(["group", "supergroup"])
                .filter((ctx) => ctx.chatId === scope.chat_id)
                .filter(isAdmin)
                .use(...middlewareArray);
            }
            break;
          case "chat_member":
            if (scope.chat_id && scope.user_id) {
              this._cachedComposer
                .filter(Command.hasCommand(this.names, optionsObject))
                .chatType(["group", "supergroup"])
                .filter((ctx) => ctx.chatId === scope.chat_id)
                .filter((ctx) => ctx.from?.id === scope.user_id)
                .use(...middlewareArray);
            }
            break;
          default:
            throw new InvalidScopeError(scope);
        }
      }
    }

    this._cachedComposer.use(this._defaultScopeComposer);
    this._cachedComposerInvalidated = false;
  }

  middleware() {
    if (this._cachedComposerInvalidated) {
      this.registerScopeHandlers();
    }

    return this._cachedComposer.middleware();
  }
}
