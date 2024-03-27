import { BotCommandScope } from "./deps.deno.ts";

export class InvalidScopeError extends Error {
    constructor(scope: BotCommandScope) {
        super(`Invalid scope: ${scope}`);
        this.name = "InvalidScopeError";
    }
}
