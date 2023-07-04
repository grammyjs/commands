import {
  BotCommand,
  BotCommandScope,
  Chat,
  ChatTypeContext,
  CommandMiddleware,
  Composer,
  Context,
  match,
  Middleware,
  P,
} from "./deps.deno.ts";

export type MaybeArray<T> = T | T[];

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
    const scope: BotCommandScope | null = match({ type, chatId, userId })
      .with(
        { type: "default" },
        { type: "all_chat_administrators" },
        { type: "all_group_chats" },
        { type: "all_private_chats" },
        ({ type }) => ({ type }),
      )
      .with(
        { type: P.union("chat", "chat_administrators"), chatId: P.not(P.nullish) },
        ({ type, chatId }) => ({ type, chat_id: chatId }),
      )
      .with(
        { type: "chat_member", chatId: P.not(P.nullish), userId: P.not(P.nullish) },
        ({ type, chatId, userId }) => ({ type, chat_id: chatId, user_id: userId }),
      )
      .otherwise(() => null);

    if (scope) this.#scopes.push(scope);

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
