import { Command } from "./command.ts";
import {
    Api,
    BotCommand,
    BotCommandScope,
    CommandContext,
    Composer,
    Context,
    Middleware,
} from "./deps.deno.ts";
import { CommandOptions } from "./types.ts";
import { type MaybeArray } from "./utils.ts";

export type SetMyCommandsParams = {
    /**
     * Interface for grouping {@link BotCommand}'s that might or might not be related to each other
     * by scope and/or language.
     *
     * If @param scope it's defined, they will only take effect on that scope.
     * If @param language_code it's defined, they will only take effect on users of that language.
     * 'Takes effect' in this case means: being displayed in the user commands menu.
     *
     * @param scope on which the commands will take effect
     * @param language_code two letter abbreviation in ISO_639 standard: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
     * @param commands that can be each one passed to a SetMyCommands Call
     */
    scope?: BotCommandScope;
    language_code?: string;
    commands: BotCommand[];
};

const isMiddleware = <C extends Context>(
    obj: unknown,
): obj is MaybeArray<Middleware<C>> => {
    if (!obj) return false;
    if (Array.isArray(obj)) return obj.every(isMiddleware);
    const objType = typeof obj;

    switch (objType) {
        case "function":
            return true;
        case "object":
            return Object.keys(obj).includes("middleware");
    }

    return false;
};

/**
 * Central class that manages all registered commands.
 * This is the starting point for the plugin, and this is what you should pass to `bot.use` so your commands get properly registered.
 *
 * @example
 * ```typescript
 * const myCommands = new Commands()
 * commands.command("start", "start the bot configuration", (ctx) => ctx.reply("Hello there!"))
 *
 * // Registers the commands with the bot instance.
 * bot.use(myCommands)
 * ```
 */
export class Commands<C extends Context> {
    private _languages: Set<string> = new Set();
    private _scopes: Map<string, Array<Command<C>>> = new Map();
    private _commands: Command<C>[] = [];
    private _composer: Composer<C> = new Composer();
    private _commandOptions: Partial<CommandOptions> = {};

    constructor(options: Partial<CommandOptions> = {}) {
        this._commandOptions = options;
    }

    private _addCommandToScope(scope: BotCommandScope, command: Command<C>) {
        const commands = this._scopes.get(JSON.stringify(scope)) ?? [];
        this._scopes.set(JSON.stringify(scope), commands.concat([command]));
    }

    private _populateComposer() {
        for (const command of this._commands) {
            this._composer.use(command.middleware());
        }
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
        const options = handler
            ? _options ?? this._commandOptions
            : handlerOrOptions as Partial<CommandOptions> ??
                this._commandOptions;

        const command = new Command<C>(name, description, options);
        if (handler) command.addToScope({ type: "default" }, handler);

        this._commands.push(command);
        return command;
    }
    /**
     * Serializes the commands into multiple objects that can each be passed to a `setMyCommands` call.
     * @returns One item for each combination of command + scope + language
     */
    public toArgs() {
        this._populateMetadata();
        const params: SetMyCommandsParams[] = [];

        for (const [scope, commands] of this._scopes.entries()) {
            for (const language of this._languages) {
                params.push({
                    scope: JSON.parse(scope),
                    language_code: language === "default"
                        ? undefined
                        : language,
                    commands: commands.map((command) =>
                        command.toObject(language)
                    )
                        .filter((args) => args.command.length > 0),
                });
            }
        }

        return params.filter((params) => params.commands.length > 0);
    }

    /**
     * Serializes the commands of a single scope into objects that can each be passed to a `setMyCommands` call.
     *
     * @param scope Selected scope to be serialized
     * @returns One item per command per language
     */
    public toSingleScopeArgs(scope: BotCommandScope) {
        this._populateMetadata();
        const params: SetMyCommandsParams[] = [];
        for (const language of this._languages) {
            params.push({
                scope,
                language_code: language === "default" ? undefined : language,
                commands: this._commands
                    .filter((command) => command.scopes.length)
                    .filter((command) => typeof command.name === "string")
                    .map((command) => command.toObject(language)),
            });
        }
        return params;
    }

    /**
     * Registers all commands to be displayed by clients according to their scopes and languages
     * Calls `setMyCommands` for each language of each scope of each command.
     *
     * @param Instance of `bot` or { api: bot.api }
     */
    public async setCommands({ api }: { api: Api }) {
        await Promise.all(
            this.toArgs().map((args) => api.raw.setMyCommands(args)),
        );
    }

    /**
     * Alias for {@link toArgs}
     */
    public toJSON() {
        return this.toArgs();
    }

    /**
     * @returns A JSON serialized version of all the currently registered commands
     */
    public toString() {
        return JSON.stringify(this);
    }

    middleware() {
        this._populateComposer();
        return this._composer.middleware();
    }

    /**
     * Replaces the `toString` method on node.js
     *
     * @see toString
     */
    [Symbol.for("Deno.customInspect")]() {
        return this.toString();
    }

    /**
     * Replaces the `toString` method on Deno
     *
     * @see toString
     */
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
}
