export type MaybeArray<T> = T | T[];
export const ensureArray = <T>(value: MaybeArray<T>): T[] =>
    Array.isArray(value) ? value : [value];
