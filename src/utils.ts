export type MaybeArray<T> = T | T[];
export const ensureArray = <T>(value: MaybeArray<T>): T[] =>
  Array.isArray(value) ? value : [value];

const specialChars = "\\.^$|?*+()[]{}-".split("");

const replaceAll = (s: string, find: string, replace: string) =>
  s.replace(new RegExp(`\\${find}`, "g"), replace);

export function escapeSpecial(str: string) {
  return specialChars.reduce(
    (acc, char) => replaceAll(acc, char, `\\${char}`),
    str,
  );
}
export function getCommandsRegex(prefix: string) {
  return new RegExp(
    `(\?\<\!\\S)(\?<prefix>${escapeSpecial(prefix)})\\S+(\\s|$)`,
    "g",
  );
}
