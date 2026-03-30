export type Item<T> = {
  value: T;
  expiresAt: number;
};

export type Options = {
  ttl?: number;
  stale?: boolean;
  tags?: string[];
};

export type SetOptions = {
  ttl?: number;
  tags?: string[];
};

export type WrapOptions<TArgs extends unknown[]> = {
  key?: string | ((...args: TArgs) => string);
  ttl?: number;
  stale?: boolean;
  tags?: string[] | ((...args: TArgs) => string[]);
};

export type CacheStats = {
  hits: number;
  misses: number;
  staleHits: number;
  pending: number;
  size: number;
};

export type CacheHooks<T> = {
  onHit?: (key: string, value: T) => void;
  onMiss?: (key: string) => void;
  onSet?: (key: string, value: T, ttl: number) => void;
  onDelete?: (key: string) => void;
  onRefresh?: (key: string, value: T) => void;
};

export type CacheEventType =
  | "hit"
  | "miss"
  | "staleHit"
  | "set"
  | "delete"
  | "refresh"
  | "invalidatePrefix"
  | "invalidateTag"
  | "sweep";

export type CacheEvent<T> = {
  type: CacheEventType;
  key?: string;
  value?: T;
  ttl?: number;
  tag?: string;
  prefix?: string;
  removed?: number;
};

export type CacheConfig<T = unknown> = {
  defaultTTL?: number;
  maxEntries?: number;
  maxPendingAgeMs?: number;
  sweepIntervalMs?: number;
  hooks?: CacheHooks<T>;
  onEvent?: (event: CacheEvent<T>) => void;
};

type PendingItem<T> = {
  promise: Promise<T>;
  cleanupTimeout: ReturnType<typeof setTimeout>;
  createdAt: number;
};

export class Cache<T> {
  private cache = new Map<string, Item<T>>();
  private pending = new Map<string, PendingItem<T>>();
  private keyTags = new Map<string, Set<string>>();
  private tagKeys = new Map<string, Set<string>>();
  private hits = 0;
  private misses = 0;
  private staleHits = 0;
  private readonly defaultTTL: number;
  private readonly maxEntries: number;
  private readonly maxPendingAgeMs: number;
  private readonly hooks?: CacheHooks<T>;
  private readonly eventHandler?: (event: CacheEvent<T>) => void;
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(defaultTTL?: number);
  constructor(config?: CacheConfig<T>);
  constructor(defaultTTLOrConfig: number | CacheConfig<T> = 5 * 60 * 1000) {
    const config =
      typeof defaultTTLOrConfig === "number"
        ? { defaultTTL: defaultTTLOrConfig }
        : defaultTTLOrConfig;

    this.defaultTTL = config.defaultTTL ?? 5 * 60 * 1000;
    this.maxEntries = config.maxEntries ?? 10_000;
    this.maxPendingAgeMs = config.maxPendingAgeMs ?? 30_000;
    this.hooks = config.hooks;
    this.eventHandler = config.onEvent;

    if (config.sweepIntervalMs && config.sweepIntervalMs > 0) {
      const timer = setInterval(() => {
        this.sweepExpired();
      }, config.sweepIntervalMs);

      if ("unref" in timer && typeof timer.unref === "function") {
        timer.unref();
      }

      this.sweepTimer = timer;
    }
  }

  private emitEvent(event: CacheEvent<T>): void {
    if (!this.eventHandler) return;
    this.eventHandler(event);
  }

  private isExpired(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return true;
    return Date.now() > item.expiresAt;
  }

  private shouldSweepPending(item: PendingItem<T>): boolean {
    return Date.now() - item.createdAt > this.maxPendingAgeMs;
  }

  private cleanupStalePending(): number {
    let removed = 0;

    for (const [key, item] of this.pending.entries()) {
      if (this.shouldSweepPending(item)) {
        clearTimeout(item.cleanupTimeout);
        this.pending.delete(key);
        removed += 1;
      }
    }

    return removed;
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    const normalized = tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    return Array.from(new Set(normalized));
  }

  private unlinkTag(tag: string, key: string): void {
    const keys = this.tagKeys.get(tag);
    if (!keys) return;
    keys.delete(key);

    if (keys.size === 0) {
      this.tagKeys.delete(tag);
    }
  }

  private clearKeyTags(key: string): void {
    const tags = this.keyTags.get(key);
    if (!tags) return;

    for (const tag of tags) {
      this.unlinkTag(tag, key);
    }

    this.keyTags.delete(key);
  }

  private assignKeyTags(key: string, tags?: string[]): void {
    this.clearKeyTags(key);

    const normalized = this.normalizeTags(tags);
    if (normalized.length === 0) return;

    const tagSet = new Set(normalized);
    this.keyTags.set(key, tagSet);

    for (const tag of tagSet) {
      const keys = this.tagKeys.get(tag);
      if (keys) {
        keys.add(key);
        continue;
      }

      this.tagKeys.set(tag, new Set([key]));
    }
  }

  private removeKeyOnly(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (!deleted) return false;
    this.clearKeyTags(key);
    return true;
  }

  private deleteByReason(
    key: string,
    eventType: CacheEventType,
    emitDeleteHook: boolean
  ): boolean {
    const deleted = this.removeKeyOnly(key);
    this.clearPending(key);

    if (!deleted) {
      return false;
    }

    if (emitDeleteHook) {
      this.hooks?.onDelete?.(key);
    }

    this.emitEvent({ type: eventType, key });
    return true;
  }

  private evictOldestIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.deleteByReason(oldestKey, "delete", true);
    }
  }

  private clearPending(key: string): void {
    const item = this.pending.get(key);
    if (!item) return;
    clearTimeout(item.cleanupTimeout);
    this.pending.delete(key);
  }

  private createPending(
    key: string,
    fn: () => Promise<T>,
    ttl: number,
    tags?: string[]
  ): Promise<T> {
    this.cleanupStalePending();

    const current = this.pending.get(key);
    if (current) {
      if (!this.shouldSweepPending(current)) {
        return current.promise;
      }

      this.clearPending(key);
    }

    const promise = fn()
      .then((value) => {
        this.set(key, value, { ttl, tags });
        return value;
      })
      .finally(() => {
        this.clearPending(key);
      });

    const cleanupTimeout = setTimeout(() => {
      // Safety net to avoid unbounded pending-map growth when an upstream promise never settles.
      this.pending.delete(key);
    }, this.maxPendingAgeMs);

    if ("unref" in cleanupTimeout && typeof cleanupTimeout.unref === "function") {
      cleanupTimeout.unref();
    }

    this.pending.set(key, {
      promise,
      cleanupTimeout,
      createdAt: Date.now(),
    });

    return promise;
  }

  private resolveSetOptions(ttlOrOptions?: number | SetOptions): SetOptions {
    if (typeof ttlOrOptions === "number") {
      return { ttl: ttlOrOptions };
    }

    return ttlOrOptions ?? {};
  }

  private countKeysWithPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        count += 1;
      }
    }
    return count;
  }

  private countPendingWithPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.pending.keys()) {
      if (key.startsWith(prefix)) {
        count += 1;
      }
    }
    return count;
  }

  private resolveWrapKey<TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<T>,
    args: TArgs,
    key?: string | ((...items: TArgs) => string)
  ): string {
    if (typeof key === "function") {
      return key(...args);
    }

    if (typeof key === "string") {
      return key;
    }

    const fnName = fn.name || "wrapped";

    try {
      return `${fnName}:${JSON.stringify(args)}`;
    } catch {
      return `${fnName}:${args.map((item) => String(item)).join("|")}`;
    }
  }

  private resolveWrapTags<TArgs extends unknown[]>(
    args: TArgs,
    tags?: string[] | ((...items: TArgs) => string[])
  ): string[] | undefined {
    if (typeof tags === "function") {
      return this.normalizeTags(tags(...args));
    }

    return this.normalizeTags(tags);
  }

  private resolveNamespacePrefix(prefix: string, name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return prefix;
    }

    if (prefix.length === 0) {
      return trimmed;
    }

    return `${prefix}:${trimmed}`;
  }

  public namespace(name: string): CacheNamespace<T> {
    return new CacheNamespace(this, this.resolveNamespacePrefix("", name));
  }

  public get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    return item.value;
  }

  public set(key: string, value: T, ttl?: number): void;
  public set(key: string, value: T, options?: SetOptions): void;
  public set(key: string, value: T, ttlOrOptions?: number | SetOptions): void {
    const options = this.resolveSetOptions(ttlOrOptions);
    const ttl = options.ttl ?? this.defaultTTL;

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.assignKeyTags(key, options.tags);
    this.evictOldestIfNeeded();

    this.hooks?.onSet?.(key, value, ttl);
    this.emitEvent({ type: "set", key, value, ttl });
  }

  public delete(key: string): void {
    this.deleteByReason(key, "delete", true);
  }

  public clear(): void {
    this.cache.clear();
    this.keyTags.clear();
    this.tagKeys.clear();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.cleanupTimeout);
    }
    this.pending.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public pendingSize(prefix?: string): number {
    this.cleanupStalePending();

    if (!prefix) {
      return this.pending.size;
    }

    return this.countPendingWithPrefix(prefix);
  }

  public stats(prefix?: string): CacheStats {
    if (prefix) {
      return {
        hits: this.hits,
        misses: this.misses,
        staleHits: this.staleHits,
        pending: this.pendingSize(prefix),
        size: this.countKeysWithPrefix(prefix),
      };
    }

    return {
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
      pending: this.pendingSize(),
      size: this.cache.size,
    };
  }

  public invalidatePrefix(prefix: string): number {
    const keys = Array.from(this.cache.keys());
    let removed = 0;

    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      if (this.deleteByReason(key, "invalidatePrefix", true)) {
        removed += 1;
      }
    }

    for (const key of Array.from(this.pending.keys())) {
      if (!key.startsWith(prefix)) continue;
      this.clearPending(key);
    }

    if (removed > 0) {
      this.emitEvent({ type: "invalidatePrefix", prefix, removed });
    }

    return removed;
  }

  public invalidateTag(tag: string): number {
    const keys = this.tagKeys.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let removed = 0;
    for (const key of Array.from(keys)) {
      if (this.deleteByReason(key, "invalidateTag", true)) {
        removed += 1;
      }
    }

    this.tagKeys.delete(tag);

    if (removed > 0) {
      this.emitEvent({ type: "invalidateTag", tag, removed });
    }

    return removed;
  }

  public sweepExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.deleteByReason(key, "delete", true);
        removed += 1;
      }
    }

    const stalePendingRemoved = this.cleanupStalePending();

    if (removed > 0 || stalePendingRemoved > 0) {
      this.emitEvent({ type: "sweep", removed: removed + stalePendingRemoved });
    }

    return removed;
  }

  public dispose(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    this.clear();
  }

  public async refresh(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T>;
  public async refresh(
    key: string,
    fn: () => Promise<T>,
    options?: SetOptions
  ): Promise<T>;
  public async refresh(
    key: string,
    fn: () => Promise<T>,
    ttlOrOptions: number | SetOptions = this.defaultTTL
  ): Promise<T> {
    const options = this.resolveSetOptions(ttlOrOptions);
    const ttl = options.ttl ?? this.defaultTTL;
    const value = await fn();
    this.set(key, value, { ttl, tags: options.tags });
    this.hooks?.onRefresh?.(key, value);
    this.emitEvent({ type: "refresh", key, value, ttl });
    return value;
  }

  public async fetch(
    key: string,
    fn: () => Promise<T>,
    options: Options = {}
  ): Promise<T> {
    const ttl = options.ttl ?? this.defaultTTL;
    const stale = options.stale ?? false;
    const tags = this.normalizeTags(options.tags);
    const cached = this.get(key);

    if (cached !== null && !this.isExpired(key)) {
      this.hits += 1;
      this.hooks?.onHit?.(key, cached);
      this.emitEvent({ type: "hit", key, value: cached });
      return cached;
    }

    if (cached !== null && stale) {
      this.staleHits += 1;
      this.hooks?.onHit?.(key, cached);
      this.emitEvent({ type: "staleHit", key, value: cached });
      void this.createPending(key, fn, ttl, tags);

      return cached;
    }

    this.misses += 1;
    this.hooks?.onMiss?.(key);
    this.emitEvent({ type: "miss", key });

    if (cached !== null) {
      this.removeKeyOnly(key);
    }

    return this.createPending(key, fn, ttl, tags);
  }

  public async getOrFetch(
    key: string,
    fn: () => Promise<T>,
    options: Options = {}
  ): Promise<T> {
    return this.fetch(key, fn, options);
  }

  public wrap<TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<T>,
    options: WrapOptions<TArgs> = {}
  ): (...args: TArgs) => Promise<T> {
    return (...args: TArgs) => {
      const key = this.resolveWrapKey(fn, args, options.key);
      const tags = this.resolveWrapTags(args, options.tags);

      return this.fetch(key, () => fn(...args), {
        ttl: options.ttl,
        stale: options.stale,
        tags,
      });
    };
  }
}

export class CacheNamespace<T> {
  constructor(
    private readonly cache: Cache<T>,
    private readonly prefix: string
  ) {}

  private withPrefix(key: string): string {
    const trimmed = key.trim();
    if (this.prefix.length === 0) {
      return trimmed;
    }

    if (trimmed.length === 0) {
      return this.prefix;
    }

    return `${this.prefix}:${trimmed}`;
  }

  public namespace(name: string): CacheNamespace<T> {
    return new CacheNamespace(this.cache, this.withPrefix(name));
  }

  public get(key: string): T | null {
    return this.cache.get(this.withPrefix(key));
  }

  public set(key: string, value: T, ttl?: number): void;
  public set(key: string, value: T, options?: SetOptions): void;
  public set(key: string, value: T, ttlOrOptions?: number | SetOptions): void {
    if (typeof ttlOrOptions === "number" || ttlOrOptions === undefined) {
      this.cache.set(this.withPrefix(key), value, ttlOrOptions);
      return;
    }

    this.cache.set(this.withPrefix(key), value, ttlOrOptions);
  }

  public delete(key: string): void {
    this.cache.delete(this.withPrefix(key));
  }

  public async refresh(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T>;
  public async refresh(
    key: string,
    fn: () => Promise<T>,
    options?: SetOptions
  ): Promise<T>;
  public async refresh(
    key: string,
    fn: () => Promise<T>,
    ttlOrOptions?: number | SetOptions
  ): Promise<T> {
    if (typeof ttlOrOptions === "number" || ttlOrOptions === undefined) {
      return this.cache.refresh(this.withPrefix(key), fn, ttlOrOptions);
    }

    return this.cache.refresh(this.withPrefix(key), fn, ttlOrOptions);
  }

  public async fetch(
    key: string,
    fn: () => Promise<T>,
    options: Options = {}
  ): Promise<T> {
    return this.cache.fetch(this.withPrefix(key), fn, options);
  }

  public async getOrFetch(
    key: string,
    fn: () => Promise<T>,
    options: Options = {}
  ): Promise<T> {
    return this.fetch(key, fn, options);
  }

  public wrap<TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<T>,
    options: WrapOptions<TArgs> = {}
  ): (...args: TArgs) => Promise<T> {
    const keyOption = options.key;
    const makeDefaultKey = (...args: TArgs): string => {
      const fnName = fn.name || "wrapped";
      try {
        return this.withPrefix(`${fnName}:${JSON.stringify(args)}`);
      } catch {
        return this.withPrefix(`${fnName}:${args.map((item) => String(item)).join("|")}`);
      }
    };

    const scopedKey =
      typeof keyOption === "function"
        ? (...args: TArgs) => this.withPrefix(keyOption(...args))
        : typeof keyOption === "string"
          ? this.withPrefix(keyOption)
          : makeDefaultKey;

    return this.cache.wrap(fn, {
      ...options,
      key: scopedKey,
    });
  }

  public size(): number {
    return this.cache.stats(this.prefix).size;
  }

  public pendingSize(): number {
    return this.cache.stats(this.prefix).pending;
  }

  public stats(): CacheStats {
    return this.cache.stats(this.prefix);
  }

  public invalidatePrefix(prefix: string): number {
    return this.cache.invalidatePrefix(this.withPrefix(prefix));
  }

  public invalidateTag(tag: string): number {
    return this.cache.invalidateTag(tag);
  }
}