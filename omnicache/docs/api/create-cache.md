---
title: createCache
---

# createCache

## 🧠 O que é

`createCache` instancia uma árvore de caches induviduais com base em um shape de objeto.

## ❓ Por que existe

Quando você tem vários tipos de dados relacionados, `createCache` evita criar múltiplas instâncias de `Cache` manualmente.

## ✅ Quando usar

- Organizando cache para múltiplas entidades (user, post, config).
- Quando cada tipo merece seu próprio cache.

## 🚫 Quando NÃO usar

- Cache único: use `new Cache()` diretamente.
- Estrutura muito simples: `new Cache()` é mais clear.

## ⚡ Exemplo mínimo funcional

```ts
const cache = createCache({
  users: {},
  posts: {},
});

// cache.users é Cache<any>
// cache.posts é Cache<any>
```

## 🧩 Exemplo real de produção

```ts
import { createCache } from "omnicache";

type User = { id: string; name: string };
type Post = { id: string; title: string };

const cacheStructure = createCache(
  {
    users: {},
    posts: {},
    config: {},
  },
  {
    defaultTTL: 30_000,
    maxEntries: 5_000,
  }
);

// Tipagem automática
export const userCache = cacheStructure.users as typeof cacheStructure.users & { fetch: <T>(key: string, fn: () => Promise<User>) => Promise<User> };
export const postCache = cacheStructure.posts;
export const configCache = cacheStructure.config;

export async function getUser(id: string): Promise<User> {
  return userCache.fetch(`user:${id}`, async () => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  });
}
```

## ⚠️ Erros comuns

### 1. Esperar que `createCache` compartilhe entre processos

**❌ Errado:**
```ts
// Processo A
const cache = createCache({ data: {} });
cache data.fetch("key", fn);

// Processo B
const cache = createCache({ data: {} });
cache.data.get("key"); // undefined - outro processo!
```

**✅ Correto:**
- Cada processo tem seu próprio cache
- Use Redis se precisar compartilhar

## 💡 Boas práticas

1. **Use `createCache` para estruturas organizadas:**
```ts
const caches = createCache(
  {
    users: {},
    posts: {},
    comments: {},
    metrics: {},
  },
  { defaultTTL: 60_000 }
);

export { caches };
```

2. **Ou use `new Cache()` para simplicidade:**
```ts
export const cache = new Cache<any>({ defaultTTL: 60_000 });
```

## Ver também

- [Cache](/docs/api/cache) - Classe principal
- [cacheOf](/docs/api/cache) - Para `createCacheManager` (mais avançado)
