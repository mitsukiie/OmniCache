import { Cache, type CacheConfig } from "./cache";

const CACHE_SEED = Symbol("CACHE_SEED");

export type CacheSeed<T> = {
  [CACHE_SEED]: true;
  config?: CacheConfig;
  // Phantom type to preserve leaf generic inference.
  __value?: T;
};

export type ManagerShape = {
  [key: string]: ManagerShape | CacheSeed<unknown>;
};

export type ResolveManager<T> = T extends CacheSeed<infer V>
  ? Cache<V>
  : T extends Record<string, unknown>
    ? { [K in keyof T]: ResolveManager<T[K]> }
    : never;

type IsPlainObject<T> = T extends object
  ? T extends (...args: never[]) => unknown
    ? false
    : T extends readonly unknown[]
      ? false
      : true
  : false;

type HasNestedObjectValues<T extends Record<string, unknown>> = {
  [K in keyof T]-?: IsPlainObject<NonNullable<T[K]>> extends true
    ? true
    : never;
}[keyof T];

type HasAnyNestedObject<T extends Record<string, unknown>> = Extract<
  HasNestedObjectValues<T>,
  true
> extends never
  ? false
  : true;

export type ResolveCreateCache<T> = T extends CacheSeed<infer V>
  ? Cache<V>
  : T extends Record<string, unknown>
    ? HasAnyNestedObject<T> extends true
      ? { [K in keyof T]: ResolveCreateCache<T[K]> }
      : Cache<T>
    : never;

export function cacheOf<T>(config?: CacheConfig): CacheSeed<T> {
  return {
    [CACHE_SEED]: true,
    config,
  } as CacheSeed<T>;
}

export function createCacheManager<T extends ManagerShape>(
  shape: T,
  baseConfig?: CacheConfig
): ResolveManager<T> {
  const buildNode = (node: ManagerShape | CacheSeed<unknown>): unknown => {
    if (isCacheSeed(node)) {
      return new Cache({
        ...baseConfig,
        ...node.config,
      });
    }

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node)) {
      out[key] = buildNode(value as ManagerShape | CacheSeed<unknown>);
    }

    return out;
  };

  return buildNode(shape) as ResolveManager<T>;
}

export function createCache<T extends Record<string, unknown>>(
  shape: T,
  baseConfig?: CacheConfig
): ResolveCreateCache<T> {
  const buildNode = (node: unknown): unknown => {
    if (isCacheSeed(node) || isLeafPlaceholder(node)) {
      return new Cache(baseConfig);
    }

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      out[key] = buildNode(value);
    }

    return out;
  };

  return buildNode(shape) as ResolveCreateCache<T>;
}

function isCacheSeed(value: unknown): value is CacheSeed<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    CACHE_SEED in (value as Record<PropertyKey, unknown>)
  );
}

function isLeafPlaceholder(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return true;
  }

  return entries.every(([, child]) => !isPlainObjectRecord(child));
}

function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}