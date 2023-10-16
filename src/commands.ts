import { Command, CommandOptions } from "./command.ts";
import {
    Api,
    BotCommand,
    BotCommandScope,
    Composer,
    Context,
} from "./deps.deno.ts";

type SetMyCommandsParams = {
    scope?: BotCommandScope;
    language_code?: string;
    commands: BotCommand[];
};

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

    public command(
        name: string | RegExp,
        description: string,
        options: Partial<CommandOptions> = this._commandOptions,
    ) {
        const command = new Command<C>(name, description, options);
        this._commands.push(command);
        return command;
    }

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

    public toSingleScopeArgs(scope: BotCommandScope) {
        this._populateMetadata();
        const params: SetMyCommandsParams[] = [];

        for (const language of this._languages) {
            params.push({
                scope,
                language_code: language === "default" ? undefined : language,
                commands: this._commands
                    .filter((command) => command.scopes.length)
                    .map((command) => command.toObject(language)),
            });
        }

        return params;
    }

    public async setCommands({ api }: { api: Api }) {
        await Promise.all(
            this.toArgs().map((args) => api.raw.setMyCommands(args)),
        );
    }

    public toJSON() {
        return this.toArgs();
    }

    public toString() {
        return JSON.stringify(this);
    }

    middleware() {
        this._populateComposer();
        return this._composer.middleware();
    }

    [Symbol.for("Deno.customInspect")]() {
        return this.toString();
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
}
