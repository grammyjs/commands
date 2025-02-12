import type {
  BotCommand,
  BotCommandScope,
  LanguageCode,
  MessageEntity,
} from "./deps.deno.ts";

/**
 * Supported command options
 */
export interface CommandOptions {
  /**
   * The prefix used to identify a command.
   * Defaults to `/`.
   */
  prefix: string;
  /**
   * Whether the command should only be matched at the start of the message.
   * Defaults to `true`.
   */
  matchOnlyAtStart: boolean;
  /**
   * Whether to ignore or only care about commands ending with the bot's username.
   * Defaults to `"optional"`.
   *
   * - `"ignored"`: only non-targeted commands are matched
   * - `"optional"`: both targeted and non-targeted commands are matched
   * - `"required"`: only targeted commands are matched
   */
  targetedCommands: "ignored" | "optional" | "required";
  /**
   * Whether match against commands in a case-insensitive manner.
   * Defaults to `false`.
   */
  ignoreCase: boolean;
}

/**
 * BotCommand representation with more information about it.
 * Specially in regards to the plugin manipulation of it
 */
export interface BotCommandX extends BotCommand {
  prefix: string;
  /**
   * Language in which this command is localize
   */
  language: LanguageCode | "default";
  /**
   * Scopes in which this command is registered
   */
  scopes: BotCommandScope[];
  /**
   * True if this command has no middleware attach to it. False if it has.
   */
  noHandler?: boolean;
}

/** represents a bot__command entity inside a text message */
export interface BotCommandEntity extends MessageEntity.CommonMessageEntity {
  type: "bot_command";
  text: string;
  prefix: string;
}
