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
type BotCommandGroupsScope = BotCommandScopeAllGroupChats | BotCommandScopeAllChatAdministrators;

const isAdmin = (ctx: Context) =>
  ctx.getAuthor().then((author) => ["administrator", "creator"].includes(author.status));

export class Command<C extends Context = Context> implements MiddlewareObj<C> {
  private _scopes: BotCommandScope[] = [];
  private _languages: Map<string, { name: string; description: string }> = new Map();
  private _composer: Composer<C> = new Composer<C>();

  constructor(name: string, description: string) {
    this._languages.set("default", { name, description });
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

  public addToScope(scope: BotCommandGroupsScope, ...middleware: ChatTypeMiddleware<C, "group" | "supergroup">[]): this;
  public addToScope(scope: BotCommandScopeAllPrivateChats, ...middleware: ChatTypeMiddleware<C, "private">[]): this;
  public addToScope(scope: BotCommandScope, ...middleware: Array<Middleware<C>>): this;
  public addToScope(scope: BotCommandScope, ...middleware: Array<Middleware<C>>): this {
    match(scope)
      .with({ type: "default" }, () => this._composer.command(this.names, ...middleware))
      .with(
        { type: "all_chat_administrators" },
        () => this._composer.filter(isAdmin).command(this.names, ...middleware),
      )
      .with({ type: "all_private_chats" }, () => this._composer.chatType("private").command(this.names, ...middleware))
      .with(
        { type: "all_group_chats" },
        () => this._composer.chatType(["group", "supergroup"]).command(this.names, ...middleware),
      )
      .with(
        { type: P.union("chat", "chat_administrators"), chat_id: P.not(P.nullish).select() },
        (chatId) =>
          this._composer.filter((ctx) => ctx.chat?.id === chatId).filter(isAdmin).command(this.names, ...middleware),
      )
      .with(
        { type: "chat_member", chat_id: P.not(P.nullish).select("chatId"), user_id: P.not(P.nullish).select("userId") },
        ({ chatId, userId }) =>
          this._composer.filter((ctx) => ctx.chat?.id === chatId)
            .filter((ctx) => ctx.from?.id === userId)
            .command(this.names, ...middleware),
      );

    this._scopes.push(scope);

    return this;
  }

  public localize(languageCode: string, name: string, description: string) {
    this._languages.set(languageCode, { name, description });
    return this;
  }

  public getLocalizedName(languageCode: string) {
    return this._languages.get(languageCode)?.name ?? this.name;
  }

  public getLocalizedDescription(languageCode: string) {
    return this._languages.get(languageCode)?.description ?? this.description;
  }

  public toObject(languageCode = "default"): BotCommand {
    return {
      command: this.getLocalizedName(languageCode),
      description: this.getLocalizedDescription(languageCode),
    };
  }

  middleware() {
    return this._composer.middleware();
  }
}
