import { Cache, CacheNamespace } from "./cache";
import { cacheOf, createCache, createCacheManager } from "./manager";

export { Cache, CacheNamespace, cacheOf, createCache, createCacheManager };
export const OmniCache = Cache;
export type {
	CacheConfig,
	CacheEvent,
	CacheEventType,
	CacheHooks,
	CacheStats,
	Item,
	Options,
	SetOptions,
	WrapOptions,
} from "./cache";
export type { CacheSeed, ResolveCreateCache, ResolveManager } from "./manager";