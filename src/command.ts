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
  private _languages: Map<string, { name: string | RegExp; description: string }> = new Map();
  private _composer: Composer<C> = new Composer<C>();

  constructor(name: string | RegExp, description: string) {
    this._languages.set("default", { name: name, description });
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
      .with({ type: "default" }, () => this.getCommandComposer(this.names).use(...middleware))
      .with(
        { type: "all_chat_administrators" },
        () => this.getCommandComposer(this.names).filter(isAdmin).use(...middleware),
      )
      .with(
        { type: "all_private_chats" },
        () => this.getCommandComposer(this.names).chatType("private").use(...middleware),
      )
      .with(
        { type: "all_group_chats" },
        () => this.getCommandComposer(this.names).chatType(["group", "supergroup"]).use(...middleware),
      )
      .with(
        { type: P.union("chat", "chat_administrators"), chat_id: P.not(P.nullish).select() },
        (chatId) =>
          this.getCommandComposer(this.names)
            .filter((ctx) => ctx.chat?.id === chatId)
            .filter(isAdmin)
            .use(...middleware),
      )
      .with(
        { type: "chat_member", chat_id: P.not(P.nullish).select("chatId"), user_id: P.not(P.nullish).select("userId") },
        ({ chatId, userId }) =>
          this.getCommandComposer(this.names)
            .filter((ctx) => ctx.chat?.id === chatId)
            .filter((ctx) => ctx.from?.id === userId)
            .use(...middleware),
      );

    this._scopes.push(scope);

    return this;
  }

  private getCommandComposer(commandNames: Array<string | RegExp>) {
    return this._composer.on("message:entities:bot_command")
      .filter((ctx) => {
        const finalRegexs = commandNames
          .map((name) => new RegExp(name))
          .map((name) => new RegExp(`^\/${name.source}(?:@${ctx.me.username})?`, name.flags));

        return ctx.entities("bot_command").some(({ text }) => finalRegexs.some((regex) => regex.test(text)));
      });
  }

  public localize(languageCode: string, name: string | RegExp, description: string) {
    this._languages.set(languageCode, { name: new RegExp(name), description });
    return this;
  }

  public getLocalizedName(languageCode: string) {
    return this._languages.get(languageCode)?.name ?? this.name;
  }

  public getLocalizedDescription(languageCode: string) {
    return this._languages.get(languageCode)?.description ?? this.description;
  }

  public toObject(languageCode = "default"): BotCommand {
    const localizedName = this.getLocalizedName(languageCode);
    return {
      command: localizedName instanceof RegExp ? "" : localizedName,
      description: this.getLocalizedDescription(languageCode),
    };
  }

  middleware() {
    return this._composer.middleware();
  }
}
