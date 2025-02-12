import { SuperExpressive } from "../deps.deno.ts";

export type MaybeArray<T> = T | T[];
export const ensureArray = <T>(value: MaybeArray<T>): T[] =>
  Array.isArray(value) ? value : [value];

export function getCommandsRegex(prefix: string) {
  return SuperExpressive()
    .assertNotBehind
    .nonWhitespaceChar
    .end()
    .namedCapture("prefix")
    .string(`${prefix}`)
    .end()
    .oneOrMore
    .nonWhitespaceChar
    .anyOf
    .whitespaceChar
    .endOfInput
    .end()
    .toRegex();
}
