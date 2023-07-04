import { Command } from "./command.ts";
import { Bot, BotCommand, BotCommandScope, Context, match, Middleware } from "./deps.deno.ts";

type SetMyCommandsParams = {
  scope?: BotCommandScope;
  language_code?: string;
  commands: BotCommand[];
};

export class Commands<C extends Context> {
  #languages: Set<string> = new Set();
  #scopes: Map<string, Array<Command<C>>> = new Map();
  #commands: Command<C>[] = [];

  constructor(commands: Command<C>[] = []) {
    commands.forEach((command) => this.#commands.push(command));
  }

  #addCommandToScope(scope: BotCommandScope, command: Command<C>) {
    const commands = this.#scopes.get(JSON.stringify(scope)) ?? [];
    this.#scopes.set(JSON.stringify(scope), commands.concat([command]));
  }

  #populate() {
    this.#languages = new Set();
    this.#scopes = new Map();

    this.#commands.forEach((command) => {
      command.scopes.forEach((scope) => this.#addCommandToScope(scope, command));
      Array.from(command.languages.keys()).forEach((language) => this.#languages.add(language));
    });
  }

  public command(name: string, description: string, ...middleware: Array<Middleware<C>>) {
    const command = new Command(name, description, ...middleware);
    this.#commands.push(command);
    return command;
  }

  public toArgs() {
    this.#populate();
    const params: SetMyCommandsParams[] = [];

    for (const [scope, commands] of this.#scopes.entries()) {
      for (const language of this.#languages) {
        params.push({
          scope: JSON.parse(scope),
          language_code: language === "default" ? undefined : language,
          commands: commands.map((command) => command.toObject(language)),
        });
      }
    }

    return params.filter((params) => params.commands.length > 0);
  }

  public toSingleScopeArgs(scope: BotCommandScope) {
    this.#populate();
    const params: SetMyCommandsParams[] = [];

    for (const language of this.#languages) {
      params.push({
        scope,
        language_code: match(language).with("default", () => undefined).otherwise((value) => value),
        commands: this.#commands
          .filter((command) => command.scopes.length)
          .map((command) => command.toObject(language)),
      });
    }

    return params;
  }

  public setFor<C extends Context>(bot: Bot<C>) {
    const argsArray = this.toArgs();
    const promises = argsArray.map((args) => bot.api.raw.setMyCommands(args));
    return Promise.all(promises);
  }

  public toJSON() {
    return this.toArgs();
  }

  public toString() {
    return JSON.stringify(this);
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString();
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }
}
