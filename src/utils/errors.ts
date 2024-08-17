import { UncompliantCommand } from "../command-group.ts";
import { BotCommandScope } from "../deps.deno.ts";

export class InvalidScopeError extends Error {
  constructor(scope: BotCommandScope) {
    super(`Invalid scope: ${scope}`);
    this.name = "InvalidScopeError";
  }
}

export class CustomPrefixNotSupportedError extends Error {
  constructor(message: string, public readonly offendingCommands: string[]) {
    super(message);
    this.name = "CustomPrefixNotSupportedError";
  }
}

export class UncompliantCommandsError extends Error {
  constructor(
    commands: Array<UncompliantCommand>,
  ) {
    const message = [
      `Tried to set bot commands with one or more commands that do not comply with the Bot API requirements for command names. Offending command(s):`,
      commands.map(({ name, reasons, language }) =>
        `- (language: ${language}) ${name}: ${reasons.join(", ")}`
      )
        .join("\n"),
      "If you want to filter these commands out automatically, set `ignoreUncompliantCommands` to `true`",
    ].join("\n");
    super(message);
  }
}
