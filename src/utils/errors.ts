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
