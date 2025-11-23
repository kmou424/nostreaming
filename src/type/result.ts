export type Result<T> = {
  err: Error | null;

  unwrap: () => T;
  unwrapOr: (defaultValue: T) => T;

  isOk: () => boolean;
  isErr: () => boolean;
} & Omit<Record<string, T | null>, "err">;

export function Result<T>(data: T): Result<T>;
export function Result<T>(err: Error): Result<T>;
export function Result<T>(data?: T, err?: Error | null): Result<T> {
  return createResult<T>(data ?? null, err ?? null);
}

const dataKey = "data";

const createResult = <T>(data: T | null, err: Error | null): Result<T> => {
  const base: {
    data: T | null;
    err: Error | null;
    unwrap: () => T;
    unwrapOr: (defaultValue: T) => T;
    isOk: () => boolean;
    isErr: () => boolean;
  } = {
    data,
    err,
    unwrap: () => {
      if (err) {
        throw err;
      }
      return data!;
    },
    unwrapOr: (defaultValue: T) => {
      if (err) {
        return defaultValue;
      }
      return data!;
    },
    isOk: () => {
      return err === null;
    },
    isErr: () => {
      return err !== null;
    },
  };

  const proxy = new Proxy(base, {
    get(target, prop: string | symbol) {
      if (prop === "err") {
        return target.err;
      }
      if (
        prop === "unwrap" ||
        prop === "unwrapOr" ||
        prop === "isOk" ||
        prop === "isErr"
      ) {
        return target[prop as keyof typeof target];
      }
      if (typeof prop === "string") {
        return target.data;
      }
      return (target as any)[prop];
    },
    has(target, prop: string | symbol) {
      if (
        prop === "err" ||
        prop === "unwrap" ||
        prop === "unwrapOr" ||
        prop === "isOk" ||
        prop === "isErr"
      ) {
        return true;
      }
      if (typeof prop === "string") {
        return true;
      }
      return prop in target;
    },
    ownKeys(target) {
      return [dataKey, "err", "unwrap", "unwrapOr", "isOk", "isErr"];
    },
    getOwnPropertyDescriptor(target, prop: string | symbol) {
      if (
        prop === "err" ||
        prop === "unwrap" ||
        prop === "unwrapOr" ||
        prop === "isOk" ||
        prop === "isErr"
      ) {
        return {
          enumerable: true,
          configurable: true,
          value: target[prop as keyof typeof target],
        };
      }
      if (typeof prop === "string") {
        return {
          enumerable: true,
          configurable: true,
          value: target.data,
        };
      }
      return undefined;
    },
  }) as unknown as Result<T>;

  return proxy;
};
