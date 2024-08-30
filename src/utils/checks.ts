import { Context, Middleware } from "../deps.deno.ts";
import { CommandOptions } from "../types.ts";
import { MaybeArray } from "./array.ts";

export function isAdmin(ctx: Context) {
  return ctx
    .getAuthor()
    .then((author) => ["administrator", "creator"].includes(author.status));
}

export function isMiddleware<C extends Context = Context>(
  obj: unknown,
): obj is MaybeArray<Middleware<C>> {
  if (!obj) return false;
  if (Array.isArray(obj)) return obj.every(isMiddleware);
  const objType = typeof obj;

  switch (objType) {
    case "function":
      return true;
    case "object":
      return Object.keys(obj).includes("middleware");
  }

  return false;
}
export function isCommandOptions(obj: unknown): obj is Partial<CommandOptions> {
  if (typeof obj !== "object" || !obj) return false;
  const { prefix, matchOnlyAtStart, targetedCommands, ignoreCase } =
    obj as Partial<CommandOptions>;

  if (typeof prefix === "string") return true;
  if (typeof matchOnlyAtStart === "boolean") return true;
  if (
    targetedCommands &&
    ["ignored", "optional", "required"].includes(targetedCommands)
  ) return true;
  if (typeof ignoreCase === "boolean") return true;

  return false;
}

export function matchesPattern(
  value: string,
  pattern: string | RegExp,
  ignoreCase = false,
) {
  const transformedValue = ignoreCase ? value.toLowerCase() : value;
  const transformedPattern =
    pattern instanceof RegExp && ignoreCase && !pattern.flags.includes("i")
      ? new RegExp(pattern, pattern.flags + "i")
      : pattern;
  return typeof transformedPattern === "string"
    ? transformedValue === transformedPattern
    : transformedPattern.test(transformedValue);
}
