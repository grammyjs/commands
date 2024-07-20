import { BotCommand, BotCommandScope } from "../deps.deno.ts";

export class InvalidScopeError extends Error {
    constructor(scope: BotCommandScope) {
        super(`Invalid scope: ${scope}`);
        this.name = "InvalidScopeError";
    }
}

export class OffenderBotCommand extends Error implements BotCommand {
    public readonly command: string;
    public readonly description: string;
    constructor(
        message: string,
        from: BotCommand,
        public readonly cause: string,
    ) {
        super(message);
        this.name = "OffendingCommand";
        this.command = from.command;
        this.description = from.description;
    }
}
