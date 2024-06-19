import {
    type BotCommand,
    type BotCommandScope,
    type BotCommandScopeAllChatAdministrators,
    type BotCommandScopeAllGroupChats,
    type BotCommandScopeAllPrivateChats,
    type ChatTypeMiddleware,
    Composer,
    type Context,
    type Middleware,
    type MiddlewareObj,
} from "./deps.deno.ts";
import { InvalidScopeError } from "./errors.ts";
import { CommandOptions } from "./types.ts";
import { ensureArray, type MaybeArray } from "./utils.ts";

type BotCommandGroupsScope =
    | BotCommandScopeAllGroupChats
    | BotCommandScopeAllChatAdministrators;

const isAdmin = (ctx: Context) =>
    ctx
        .getAuthor()
        .then((author) => ["administrator", "creator"].includes(author.status));

export const matchesPattern = (value: string, pattern: string | RegExp) =>
    typeof pattern === "string" ? value === pattern : pattern.test(value);

/**
 * Class that represents a single command and allows you to configure it.
 */
export class Command<C extends Context = Context> implements MiddlewareObj<C> {
    private _scopes: BotCommandScope[] = [];
    private _languages: Map<
        string,
        { name: string | RegExp; description: string }
    > = new Map();
    private _composer: Composer<C> = new Composer<C>();
    private _options: CommandOptions = {
        prefix: "/",
        matchOnlyAtStart: true,
        targetedCommands: "optional",
    };

    /**
     * Constructor for the `Command` class.
     * Do not call this directly. Instead, use the `command` method from the `Commands` class
     *
     * @param name Default command name
     * @param description Default command description
     * @param options Options object that should apply to this command only
     * @access package
     */
    constructor(
        name: string | RegExp,
        description: string,
        options: Partial<CommandOptions> = {},
    ) {
        this._options = { ...this._options, ...options };
        if (this._options.prefix === "") this._options.prefix = "/";
        this._languages.set("default", { name: name, description });
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
     * Registers the command to a scope to allow it to be handled and used with `setMyCommands`.
     * This will automatically apply filtering middlewares for you, so the handler only runs on the specified scope.
     *
     * @example
     * ```ts
     * const myCommands = new Commands();
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

        switch (scope.type) {
            case "default":
                this._composer
                    .filter(Command.hasCommand(this.names, optionsObject))
                    .use(...middlewareArray);
                break;
            case "all_chat_administrators":
                this._composer
                    .filter(Command.hasCommand(this.names, optionsObject))
                    .filter(isAdmin)
                    .use(...middlewareArray);
                break;
            case "all_private_chats":
                this._composer
                    .filter(Command.hasCommand(this.names, optionsObject))
                    .chatType("private")
                    .use(...middlewareArray);
                break;
            case "all_group_chats":
                this._composer
                    .filter(Command.hasCommand(this.names, optionsObject))
                    .chatType(["group", "supergroup"])
                    .use(...middlewareArray);
                break;
            case "chat":
            case "chat_administrators":
                if (scope.chat_id) {
                    this._composer
                        .filter(Command.hasCommand(this.names, optionsObject))
                        .filter((ctx) => ctx.chat?.id === scope.chat_id)
                        .filter(isAdmin)
                        .use(...middlewareArray);
                }
                break;
            case "chat_member":
                if (scope.chat_id && scope.user_id) {
                    this._composer
                        .filter(Command.hasCommand(this.names, optionsObject))
                        .filter((ctx) => ctx.chat?.id === scope.chat_id)
                        .filter((ctx) => ctx.from?.id === scope.user_id)
                        .use(...middlewareArray);
                }
                break;
            default:
                throw new InvalidScopeError(scope);
        }

        this._scopes.push(scope);

        return this;
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
        const { matchOnlyAtStart, prefix, targetedCommands } = options;

        return (ctx: Context) => {
            if (!ctx.has(":text")) return false;
            if (matchOnlyAtStart && !ctx.msg.text.startsWith(prefix)) {
                return false;
            }

            const commandNames = ensureArray(command);
            const commands = prefix === "/"
                ? ctx.entities("bot_command")
                : ctx.msg.text.split(prefix).map((text) => ({ text }));

            for (const { text } of commands) {
                const [command, username] = text.split("@");
                if (targetedCommands === "ignored" && username) continue;
                if (targetedCommands === "required" && !username) continue;
                if (username && username !== ctx.me.username) continue;
                if (
                    commandNames.some((name) =>
                        matchesPattern(command.replace(prefix, ""), name)
                    )
                ) {
                    return true;
                }
            }

            return false;
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
        languageCode: string,
        name: string | RegExp,
        description: string,
    ) {
        this._languages.set(languageCode, {
            name: name,
            description,
        });
        return this;
    }

    /**
     * Gets the localized command name of an existing translation
     * @param languageCode Language to get the name for
     * @returns Localized command name
     */
    public getLocalizedName(languageCode: string) {
        return this._languages.get(languageCode)?.name ?? this.name;
    }

    /**
     * Gets the localized command name of an existing translation
     * @param languageCode Language to get the name for
     * @returns Localized command name
     */
    public getLocalizedDescription(languageCode: string) {
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
    public toObject(languageCode = "default"): BotCommand {
        const localizedName = this.getLocalizedName(languageCode);
        return {
            command: localizedName instanceof RegExp
                ? localizedName.source
                : localizedName,
            description: this.getLocalizedDescription(languageCode),
        };
    }

    middleware() {
        return this._composer.middleware();
    }
}
