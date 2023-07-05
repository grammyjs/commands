import {
  Bot,
  BotCommand,
  BotCommandScope,
  Chat,
  ChatTypeContext,
  CommandMiddleware,
  Composer,
  Context,
  Middleware,
} from "./deps.deno.ts";

type MaybeArray<T> = T | T[];
type SetMyCommandsParams = {
  scope?: BotCommandScope;
  language_code?: string;
  commands: BotCommand[];
};

export class Command<C extends Context = Context> extends Composer<C> {
  #scopes: BotCommandScope[] = [];
  #languages: Map<string, { name: string; description: string }> = new Map();

  constructor(name: string, description: string, ...middleware: Array<Middleware<C>>) {
    super();

    if (!name.match(/[a-z0-9_]{1,32}/)) {
      throw new Error(`${name} is not a valid command name`);
    }

    this.#languages.set("default", { name, description });

    this.command(name, ...middleware);
  }

  get languages() {
    return this.#languages;
  }
  get scopes() {
    return this.#scopes;
  }

  get name() {
    return this.#languages.get("default")!.name;
  }

  get description() {
    return this.#languages.get("default")!.description;
  }

  public addToScope(type: "default" | "all_private_chats" | "all_group_chats" | "all_chat_administrators"): this;
  public addToScope(type: "chat", chatId: string | number): this;
  public addToScope(type: "chat_member", chatId: string | number, userId: number): this;
  public addToScope(type: "chat_administrators", chatId: string | number): this;
  public addToScope(type: BotCommandScope["type"], chatId?: string | number, userId?: number): this {
    switch (type) {
      case "chat":
        this.#scopes.push({ type, chat_id: chatId! });
        break;
      case "chat_administrators":
        this.#scopes.push({ type, chat_id: chatId! });
        break;
      case "chat_member":
        this.#scopes.push({ type, chat_id: chatId!, user_id: userId! });
        break;
      default:
        this.#scopes.push({ type });
        break;
    }

    return this;
  }

  public localize(languageCode: string, name: string, description: string) {
    this.#languages.set(languageCode, { name, description });
    return this;
  }

  public getLocalizedName(languageCode: string) {
    return this.#languages.get(languageCode)?.name ?? this.name;
  }

  public getLocalizedDescription(languageCode: string) {
    return this.#languages.get(languageCode)?.description ?? this.description;
  }

  public onChatType<T extends Chat["type"]>(
    chatType: MaybeArray<T>,
    ...middleware: Array<CommandMiddleware<ChatTypeContext<C, T>>>
  ) {
    const names = Array.from(this.#languages.values()).map(({ name }) => name);
    this.chatType(chatType).command(names, ...middleware);
    return this;
  }

  public toObject(languageCode = "default"): BotCommand {
    return {
      command: this.getLocalizedName(languageCode),
      description: this.getLocalizedDescription(languageCode),
    };
  }
}

export class CommandCollection<C extends Context> {
  #languages: Set<string> = new Set();
  #scopes: Map<string, Array<Command<C>>> = new Map();
  #commands: Command<C>[] = [];

  constructor(commands: Command<C>[] = []) {
    commands.forEach((command) => this.add(command));
  }

  private addCommandToScope(scope: BotCommandScope, command: Command<C>) {
    const commands = this.#scopes.get(JSON.stringify(scope)) ?? [];
    this.#scopes.set(JSON.stringify(scope), commands.concat([command]));
  }

  public add(...commands: Command<C>[]) {
    commands.forEach((command) => {
      this.#commands.push(command);
      command.scopes.forEach((scope) => this.addCommandToScope(scope, command));
      Array.from(command.languages.keys()).forEach((language) => this.#languages.add(language));
    });
    return this;
  }

  public toArgs() {
    const params: SetMyCommandsParams[] = [];

    for (const [scope, commands] of this.#scopes.entries()) {
      for (const language of this.#languages) {
        params.push({
          scope: JSON.parse(scope),
          language_code: language === "default" ? undefined : language,
          commands: commands.map((command) => command.toObject(language)) ?? [],
        });
      }
    }

    return params.filter((params) => params.commands.length > 0);
  }

  public setFor(bot: Bot<C>) {
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
