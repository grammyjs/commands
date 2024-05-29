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
import { type CommandElementals } from "./jaro-winkler.ts";
import { CommandOptions } from "./types.ts";
import { type MaybeArray } from "./utils.ts";

/**
 * Interface for grouping {@link BotCommand}'s that might (or not)
 * be related to each other by scope and/or language.
 */
export type SetMyCommandsParams = {
    /** If defined: scope on which the commands will take effect */
    scope?: BotCommandScope;
    /** If defined: Language on which the commands will take effect.
     * Two letter abbreviation in ISO_639 standard: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
     */
    language_code?: string;
    /** commands that can be each one passed to a SetMyCommands Call */
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
     * Serialize all register commands into an array of {@link CommandElementals},
     * each registered command would be summarize into it's name, prefix and language
     *
     * @param filterLanguage if given and valid, it would filter all command localizations
     * that not match the filterLanguage,
     * if a command does not have the given language, it would fallback to "default"
     *
     * Note: mainly used to serialize for {@link FuzzyMatch}
     */

    public toElementals(filterLanguage?: string): CommandElementals[] {
        this._populateMetadata();
        if (!filterLanguage) {
            const commands = [];
            for (const [_scope, _commands] of this._scopes.entries()) {
                for (const language of this._languages) {
                    commands.push(
                        ..._commands.map((command) => ({
                            name: command.toObject(language).command,
                            language,
                            prefix: command.prefix,
                        })).filter((command) => command.name.length > 0),
                    );
                }
            }
            return commands;
        }

        const commands = Array.from(this._scopes.values())
            .flat()
            .map((command) => {
                let local = command.languages.get(filterLanguage);
                local ??= command.languages.get("default");
                if (!local) {
                    throw "never: If a command exist, 'default' should exist in _languages";
                }
                return {
                    name: local.name instanceof RegExp
                        ? local.name.source
                        : local.name,
                    prefix: command.prefix,
                    language: filterLanguage,
                };
            });
        const visited: Record<string, boolean> = {};
        return commands.filter((command) => {
            if (visited[command.name]) return false;
            visited[command.name] = true;
            return true;
        });
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
