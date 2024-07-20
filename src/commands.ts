import { Command } from "./command.ts";
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
import { type MaybeArray } from "./utils/array.ts";
import { CustomPrefixNotSupportedError } from "./utils/errors.ts";
import {
    setBotCommands,
    SetBotCommandsOptions,
} from "./utils/set-bot-commants.ts";

/**
 * Interface for grouping {@link BotCommand}s that might (or not)
 * be related to each other by scope and/or language.
 */
export type SetMyCommandsParams = {
    /** If defined: scope on which the commands will take effect */
    scope?: BotCommandScope;
    /** If defined: Language on which the commands will take effect.
     * Two letter abbreviation in ISO_639 standard: https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
     */
    language_code?: LanguageCode;
    /** Commands that can be each one passed to a SetMyCommands Call */
    commands: BotCommand[];
};

/**
 * Options for methods that convert the commands into `setMyCommands` args.
 */
export interface ToArgsOptions {
    /**
     * If true, commands that are not valid will be filtered out.
     * Otherwise, an error will be thrown.
     *
     * @default false
     */
    ignoreCommandsWithCustomPrefixes?: boolean;
}

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
    private _languages: Set<LanguageCode | "default"> = new Set();
    private _scopes: Map<string, Array<Command<C>>> = new Map();
    private _commands: Command<C>[] = [];

    private _cachedComposer: Composer<C> = new Composer();
    private _cachedComposerInvalidated: boolean = false;

    private _commandOptions: Partial<CommandOptions> = {};

    constructor(options: Partial<CommandOptions> = {}) {
        this._commandOptions = options;
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
        const options = handler
            ? _options ?? this._commandOptions
            : handlerOrOptions as Partial<CommandOptions> ??
                this._commandOptions;

        const command = new Command<C>(name, description, options);
        if (handler) command.addToScope({ type: "default" }, handler);

        this._commands.push(command);
        this._cachedComposerInvalidated = true;
        return command;
    }
    /**
     * Serializes the commands into multiple objects that can each be passed to a `setMyCommands` call.
     *
     * @param options Options for the serialization
     * @returns One item for each combination of command + scope + language
     */
    public toArgs(
        options: Partial<ToArgsOptions> = {},
    ) {
        const { ignoreCommandsWithCustomPrefixes } = options;
        this._populateMetadata();
        const params: SetMyCommandsParams[] = [];

        for (const [scope, commands] of this._scopes.entries()) {
            for (const language of this._languages) {
                const commandsWithCustomPrefix =
                    ignoreCommandsWithCustomPrefixes
                        ? []
                        : commands.filter((command) =>
                            command.prefix && command.prefix !== "/"
                        );

                if (
                    commandsWithCustomPrefix.length &&
                    !ignoreCommandsWithCustomPrefixes
                ) {
                    throw new CustomPrefixNotSupportedError(
                        `toArgs called for commands with custom prefixes, which cannot be converted into setMyCommands args: ${
                            commandsWithCustomPrefix
                                .map((command) => command.name)
                                .join(", ")
                        }`,
                        commandsWithCustomPrefix.map((command) =>
                            command.name.toString()
                        ),
                    );
                }

                params.push({
                    scope: JSON.parse(scope),
                    language_code: language === "default"
                        ? undefined
                        : language,
                    commands: commands
                        .filter((command) => typeof command.name === "string")
                        .filter((command) =>
                            !command.prefix || command.prefix === "/"
                        )
                        .map((command) => command.toObject(language)),
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
    public toSingleScopeArgs(
        scope: BotCommandScope,
        options: Partial<ToArgsOptions> = {},
    ) {
        const { ignoreCommandsWithCustomPrefixes } = options;

        this._populateMetadata();

        const params: SetMyCommandsParams[] = [];
        for (const language of this._languages) {
            const commandsWithCustomPrefix = ignoreCommandsWithCustomPrefixes
                ? []
                : this._commands.filter((
                    command,
                ) => command.prefix && command.prefix !== "/");

            if (
                commandsWithCustomPrefix.length &&
                !ignoreCommandsWithCustomPrefixes
            ) {
                throw new CustomPrefixNotSupportedError(
                    `toSingleScopeArgs called for commands with custom prefixes, which cannot be converted into setMyCommands args: ${
                        commandsWithCustomPrefix
                            .map((command) => command.name)
                            .join(", ")
                    }`,
                    commandsWithCustomPrefix.map((command) =>
                        command.name.toString()
                    ),
                );
            }

            params.push({
                scope,
                language_code: language === "default" ? undefined : language,
                commands: this._commands
                    .filter((command) => command.scopes.length)
                    .filter((command) => typeof command.name === "string")
                    .filter((command) =>
                        !command.prefix || command.prefix === "/"
                    )
                    .map((command) => command.toObject(language)),
            });
        }
        return params;
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
        options?: Partial<SetBotCommandsOptions> & Partial<ToArgsOptions>,
    ) {
        try {
            await setBotCommands(api, this.toArgs(options), options);
        } catch (error) {
            if (error instanceof CustomPrefixNotSupportedError) {
                throw new Error(
                    `Tried to call setCommands with a command that has a custom prefix, which is not supported by the Bot API. Offending command(s): ${
                        error.offendingCommands.join(", ")
                    }`,
                );
            }
        }
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
