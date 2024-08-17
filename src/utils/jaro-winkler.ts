import { CommandGroup } from "../command-group.ts";
import { Context, LanguageCode, LanguageCodes } from "../deps.deno.ts";
import type { CommandElementals } from "../types.ts";

export function distance(s1: string, s2: string) {
  if (s1.length === 0 || s2.length === 0) {
    return 0;
  }

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2.0) - 1;
  const matches1 = new Array(s1.length);
  const matches2 = new Array(s2.length);
  let m = 0; // number of matches
  let t = 0; // number of transpositions
  let i = 0; // index for string 1
  let k = 0; // index for string 2

  for (i = 0; i < s1.length; i++) {
    // loop to find matched characters
    const start = Math.max(0, i - matchWindow); // use the higher of the window diff
    const end = Math.min(i + matchWindow + 1, s2.length); // use the min of the window and string 2 length

    for (k = start; k < end; k++) {
      // iterate second string index
      if (matches2[k]) {
        // if second string character already matched
        continue;
      }
      if (s1[i] !== s2[k]) {
        // characters don't match
        continue;
      }

      // assume match if the above 2 checks don't continue
      matches1[i] = true;
      matches2[k] = true;
      m++;
      break;
    }
  }

  // nothing matched
  if (m === 0) {
    return 0.0;
  }

  k = 0; // reset string 2 index
  for (i = 0; i < s1.length; i++) {
    // loop to find transpositions
    if (!matches1[i]) {
      // non-matching character
      continue;
    }
    while (!matches2[k]) {
      // move k index to the next match
      k++;
    }
    if (s1[i] !== s2[k]) {
      // if the characters don't match, increase transposition
      // HtD: t is always less than the number of matches m, because transpositions are a subset of matches
      t++;
    }
    k++; // iterate k index normally
  }

  // transpositions divided by 2
  t /= 2.0;

  return (m / s1.length + m / s2.length + (m - t) / m) / 3.0; // HtD: therefore, m - t > 0, and m - t < m
  // HtD: => return value is between 0 and 1
}

export type JaroWinklerOptions = {
  ignoreCase?: boolean;
  similarityThreshold?: number;
  language?: LanguageCode | string;
  ignoreLocalization?: boolean;
};

type CommandSimilarity = {
  command: CommandElementals | null;
  similarity: number;
};

// Computes the Winkler distance between two string -- intrepreted from:
// http://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
// s1 is the first string to compare
// s2 is the second string to compare
// dj is the Jaro Distance (if you've already computed it), leave blank and the method handles it
// ignoreCase: if true strings are first converted to lower case before comparison
export function JaroWinklerDistance(
  s1: string,
  s2: string,
  options: Pick<Partial<JaroWinklerOptions>, "ignoreCase">,
) {
  if (s1 === s2) {
    return 1;
  } else {
    if (options.ignoreCase) {
      s1 = s1.toLowerCase();
      s2 = s2.toLowerCase();
    }

    const jaro = distance(s1, s2);
    const p = 0.1; // default scaling factor
    let l = 0; // length of the matching prefix
    while (s1[l] === s2[l] && l < 4) {
      l++;
    }

    // HtD: 1 - jaro >= 0
    return jaro + l * p * (1 - jaro);
  }
}

export function isLanguageCode(
  value: string | undefined,
): value is LanguageCode {
  return Object.values(LanguageCodes).includes(value as LanguageCode);
}

export function fuzzyMatch<C extends Context>(
  userInput: string,
  commands: CommandGroup<C>,
  options: Partial<JaroWinklerOptions>,
): CommandSimilarity | null {
  const defaultSimilarityThreshold = 0.82;
  const similarityThreshold = options.similarityThreshold ||
    defaultSimilarityThreshold;

  /**
   * ctx.from.id is IETF
   * https://en.wikipedia.org/wiki/IETF_language_tag
   */
  const possiblyISO639 = options.language?.split("-")[0];
  const language = isLanguageCode(possiblyISO639) ? possiblyISO639 : undefined;

  const cmds = options.ignoreLocalization
    ? commands.toElementals()
    : commands.toElementals(language);

  const bestMatch = cmds.reduce(
    (best: CommandSimilarity, command) => {
      const similarity = JaroWinklerDistance(userInput, command.name, {
        ...options,
      });
      return similarity > best.similarity ? { command, similarity } : best;
    },
    { command: null, similarity: 0 },
  );

  return bestMatch.similarity > similarityThreshold ? bestMatch : null;
}
