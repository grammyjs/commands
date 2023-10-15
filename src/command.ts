import {
  type BotCommand,
  type BotCommandScope,
  type BotCommandScopeAllChatAdministrators,
  type BotCommandScopeAllGroupChats,
  type BotCommandScopeAllPrivateChats,
  type ChatTypeMiddleware,
  Composer,
  type Context,
  match,
  type Middleware,
  type MiddlewareObj,
  P,
} from "./deps.deno.ts";

export type MaybeArray<T> = T | T[];

export type CommandOptions = {
  /**
   * The prefix used to identify a command.
   * Defaults to `/`.
   */
  prefix: string;
  /**
   * Whether the command should only be matched at the start of the message.
   * Defaults to `true`.
   */
  matchOnlyAtStart: boolean;
  /**
   * Whether to ignore or only care about commands ending with the bot's username.
   * Defaults to `"optional"`.
   *
   * - `"ignored"`: only non-targeted commands are matched
   * - `"optional"`: both targeted and non-targeted commands are matched
   * - `"ignored"`: only targeted commands are matched
   */
  targetedCommands: "ignored" | "optional" | "required";
};

type BotCommandGroupsScope = BotCommandScopeAllGroupChats | BotCommandScopeAllChatAdministrators;

const ensureArray = <T>(value: MaybeArray<T>): T[] => Array.isArray(value) ? value : [value];

const isAdmin = (ctx: Context) =>
  ctx.getAuthor().then((author) => ["administrator", "creator"].includes(author.status));

export const matchesPattern = (value: string, pattern: string | RegExp) =>
  typeof pattern === "string" ? value === pattern : pattern.test(value);

export class Command<C extends Context = Context> implements MiddlewareObj<C> {
  private _scopes: BotCommandScope[] = [];
  private _languages: Map<string, { name: string | RegExp; description: string }> = new Map();
  private _composer: Composer<C> = new Composer<C>();
  private _options: CommandOptions = {
    prefix: "/",
    matchOnlyAtStart: true,
    targetedCommands: "optional",
  };

  constructor(name: string | RegExp, description: string, options: Partial<CommandOptions> = {}) {
    this._options = { ...this._options, ...options };
    if (this._options.prefix === "") this._options.prefix = "/";
    this._languages.set("default", { name: name, description });
  }

  get scopes() {
    return this._scopes;
  }

  get languages() {
    return this._languages;
  }

  get names() {
    return Array.from(this._languages.values()).map(({ name }) => name);
  }

  get name() {
    return this._languages.get("default")!.name;
  }

  get description() {
    return this._languages.get("default")!.description;
  }

  public addToScope(
    scope: BotCommandGroupsScope,
    middleware: MaybeArray<ChatTypeMiddleware<C, "group" | "supergroup">>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScopeAllPrivateChats,
    middleware: MaybeArray<ChatTypeMiddleware<C, "private">>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScope,
    middleware: MaybeArray<Middleware<C>>,
    options?: Partial<CommandOptions>,
  ): this;
  public addToScope(
    scope: BotCommandScope,
    middleware: MaybeArray<Middleware<C>>,
    options: Partial<CommandOptions> = this._options,
  ): this {
    const middlewareArray = ensureArray(middleware);
    const optionsObject = { ...this._options, ...options };
    match(scope)
      .with(
        { type: "default" },
        () =>
          this._composer
            .filter(Command.hasCommand(this.names, optionsObject))
            .use(...middlewareArray),
      )
      .with(
        { type: "all_chat_administrators" },
        () =>
          this._composer
            .filter(Command.hasCommand(this.names, optionsObject))
            .filter(isAdmin)
            .use(...middlewareArray),
      )
      .with(
        { type: "all_private_chats" },
        () =>
          this._composer
            .filter(Command.hasCommand(this.names, optionsObject))
            .chatType("private")
            .use(
              ...middlewareArray,
            ),
      )
      .with(
        { type: "all_group_chats" },
        () =>
          this._composer
            .filter(Command.hasCommand(this.names, optionsObject))
            .chatType(["group", "supergroup"])
            .use(
              ...middlewareArray,
            ),
      )
      .with(
        { type: P.union("chat", "chat_administrators"), chat_id: P.not(P.nullish).select() },
        (chatId) =>
          this._composer.filter(Command.hasCommand(this.names, optionsObject))
            .filter((ctx) => ctx.chat?.id === chatId)
            .filter(isAdmin)
            .use(...middlewareArray),
      )
      .with(
        { type: "chat_member", chat_id: P.not(P.nullish).select("chatId"), user_id: P.not(P.nullish).select("userId") },
        ({ chatId, userId }) =>
          this._composer
            .filter(Command.hasCommand(this.names, optionsObject))
            .filter((ctx) => ctx.chat?.id === chatId)
            .filter((ctx) => ctx.from?.id === userId)
            .use(...middlewareArray),
      );

    this._scopes.push(scope);

    return this;
  }

  public static hasCommand(command: MaybeArray<string | RegExp>, options: CommandOptions) {
    const { matchOnlyAtStart, prefix, targetedCommands } = options;

    return (ctx: Context) => {
      if (!ctx.has(":text")) return false;
      if (matchOnlyAtStart && !ctx.msg.text.startsWith(prefix)) return false;

      const commandNames = ensureArray(command);
      const commands = prefix === "/"
        ? ctx.entities("bot_command")
        : ctx.msg.text.split(prefix).map((text) => ({ text }));

      for (const { text } of commands) {
        const [command, username] = text.split("@");
        if (targetedCommands === "ignored" && username) continue;
        if (targetedCommands === "required" && !username) continue;
        if (username && username !== ctx.me.username) continue;
        if (commandNames.some((name) => matchesPattern(command.replace(prefix, ""), name))) return true;
      }

      return false;
    };
  }

  public localize(languageCode: string, name: string | RegExp, description: string) {
    this._languages.set(languageCode, { name: new RegExp(name), description });
    return this;
  }

  public getLocalizedName(languageCode: string) {
    return this._languages.get(languageCode)?.name ?? this.name;
  }

  public getLocalizedDescription(languageCode: string) {
    return this._languages.get(languageCode)?.description ?? this.description;
  }

  public toObject(languageCode = "default"): BotCommand {
    const localizedName = this.getLocalizedName(languageCode);
    return {
      command: localizedName instanceof RegExp ? "" : localizedName,
      description: this.getLocalizedDescription(languageCode),
    };
  }

  middleware() {
    return this._composer.middleware();
  }
}
