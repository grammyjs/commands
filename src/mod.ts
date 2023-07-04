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

export class CommandScope<C extends Context> extends Composer<C> {
  #scope: BotCommandScope = { type: "default" };
  #commands: Command<C>[] = [];

  private constructor(scope: BotCommandScope) {
    super();
    this.#scope = scope;
  }

  public static default() {
    return new CommandScope({ type: "default" });
  }

  public static private() {
    return new CommandScope({ type: "all_private_chats" });
  }

  public static groups() {
    return new CommandScope({ type: "all_group_chats" });
  }

  public static admins() {
    return new CommandScope({ type: "all_chat_administrators" });
  }

  public static chat(chatId: number | string) {
    return new CommandScope({ type: "chat", chat_id: chatId });
  }

  public static chatAdmins(chatId: number | string) {
    return new CommandScope({ type: "chat_administrators", chat_id: chatId });
  }

  public static chatMember(chatId: number | string, userId: number) {
    return new CommandScope({ type: "chat_member", chat_id: chatId, user_id: userId });
  }

  public add(commands: MaybeArray<Command<C>>) {
    const commandArr = Array.isArray(commands) ? commands : [commands];
    this.#commands.push(...commandArr);
    this.use(...commandArr);
    return this;
  }

  private get languages() {
    return Array.from<string | undefined>(this.#commands.reduce((langs, command) => {
      langs;
      Array.from(command.localizedProperties.keys()).forEach((lang) => langs.add(lang));
      return langs;
    }, new Set<string>())).concat([undefined]);
  }

  public toParams(): Array<{ scope: BotCommandScope; language_code?: string; commands: BotCommand[] }> {
    return this.languages.map((languageCode) => ({
      scope: this.#scope,
      language_code: languageCode,
      commands: this.#commands.map((command) => command.toObject(languageCode)),
    }));
  }

  public setFor(bot: Bot<C>) {
    const language = this.toParams();
    return Promise.all(language.map((args) => bot.api.raw.setMyCommands(args)));
  }

  public deleteFor(bot: Bot<C>) {
    return Promise.all(
      this.languages.map((languageCode) =>
        bot.api.deleteMyCommands({ language_code: languageCode, scope: this.#scope })
      ),
    );
  }
}

export class Command<C extends Context> extends Composer<C> {
  #name: string;
  #description: string;
  localizedProperties: Map<string, { name: string; description: string }> = new Map();

  constructor(name: string, description: string, ...middleware: Array<Middleware<C>>) {
    super();

    if (!name.match(/[a-z0-9_]{1,32}/)) {
      throw new Error(`${name} is not a valid command name`);
    }

    this.#name = name;
    this.#description = description;

    this.command(name, ...middleware);
  }

  public description(text: string) {
    this.#description = text;
    return this;
  }

  public localize(languageCode: string, name: string, description: string) {
    this.localizedProperties.set(languageCode, { name, description });
    return this;
  }

  public getLocalizedName(languageCode: string) {
    return this.localizedProperties.get(languageCode)?.name ?? this.#name;
  }

  public getLocalizedDescription(languageCode: string) {
    return this.localizedProperties.get(languageCode)?.description ?? this.#description;
  }

  onChatType<T extends Chat["type"]>(
    chatType: MaybeArray<T>,
    ...middleware: Array<CommandMiddleware<ChatTypeContext<C, T>>>
  ) {
    this.chatType(chatType).command(this.#name, ...middleware);
    return this;
  }

  private toLocalizedObject(languageCode: string): BotCommand {
    return {
      command: this.getLocalizedName(languageCode),
      description: this.getLocalizedDescription(languageCode),
    };
  }

  public toObject(languageCode?: string): BotCommand {
    if (languageCode) return this.toLocalizedObject(languageCode);

    return {
      command: this.#name,
      description: this.#description,
    };
  }
}
