import { SuperExpressive } from "../deps.deno.ts";

export const escapeEspecial = (prefix: string) =>
  SuperExpressive().namedCapture("prefix")
    .string(`${prefix}`)
    .end()
    .toRegex()
    .source;

const notBehindWhitespace = SuperExpressive()
  .assertNotBehind
  .nonWhitespaceChar
  .end()
  .toRegex()
  .source;

const hasCharsAndDetectEnd = SuperExpressive()
  .oneOrMore
  .nonWhitespaceChar
  .anyOf
  .whitespaceChar
  .endOfInput
  .end()
  .toRegex()
  .source;

export function getCommandsLikeRegex(prefix: string) {
  return new RegExp(
    notBehindWhitespace + escapeEspecial(prefix) + hasCharsAndDetectEnd,
    "g",
  );
}

export const DISALLOWED_SPECIAL_CHARACTERS = SuperExpressive()
  .caseInsensitive
  .allowMultipleMatches
  .anythingBut
  .range("0", "9")
  .range("a", "z")
  .char("_")
  .end()
  .toRegex();

export const NO_PREFIX_COMMAND_MATCHER = SuperExpressive()
  .namedCapture("command")
  .oneOrMore
  .anythingButChars("@ ")
  .end()
  .optional.group
  .char("@")
  .subexpression(
    SuperExpressive()
      .namedCapture("username")
      .zeroOrMore
      .nonWhitespaceChar
      .end(),
  )
  .end()
  .subexpression(
    SuperExpressive()
      .namedCapture("rest")
      .zeroOrMore
      .anyChar
      .end(),
  ).toRegex();
