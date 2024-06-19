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
}

export interface CommandElementals {
    name: string;
    prefix: string;
    language: string;
}
