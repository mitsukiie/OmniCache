---
title: hooks
---

# hooks

## 🧠 O que é

Hooks são callbacks que OmniCache dispara em eventos específicos (hit, miss, set, delete, refresh). Úteis para logging e observabilidade.

## ❓ Por que existe

Para monitorar o que está acontecendo no cache sem modificar a lógica principal.

## ✅ Quando usar

- Logging em desenvolvimento.
- Métricas de cache em produção.
- Debug de comportamento inesperado.
- Alertas customizados.

## 🚫 Quando NÃO usar

- Lógica crítica dependendo de hooks (pode falhar silenciosamente).
- Operações pesadas dentro de hooks (bloqueia cache).

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>({
  hooks: {
    onHit: (key) => console.log("HIT", key),
    onMiss: (key) => console.log("MISS", key),
  },
});

cache.set("data", "value");
cache.get("data"); // HIT data
cache.get("missing"); // MISS missing
```

## 🧩 Exemplo real de produção

```ts
type UserData = { id: string; name: string };
const userCache = new Cache<UserData>({
  defaultTTL: 30_000,
  hooks: {
    onHit: (key) => {
      console.log(`[CACHE HIT] ${key}`);
    },
    onMiss: (key) => {
      console.log(`[CACHE MISS] ${key} - buscando do servidor...`);
    },
    onSet: (key, value, ttl) => {
      console.log(`[CACHE SET] ${key} = ${JSON.stringify(value)} (TTL: ${ttl}ms)`);
    },
    onDelete: (key) => {
      console.log(`[CACHE DELETE] ${key}`);
    },
    onRefresh: (key) => {
      console.log(`[CACHE REFRESH] ${key} atualizado`);
    },
  },
});

export async function getUser(id: string): Promise<UserData> {
  return userCache.fetch(`user:${id}`, async () => {
    const res = await fetch(`https://api.example.com/users/${id}`);
    return res.json() as Promise<UserData>;
  });
}
```

## ⚠️ Erros comuns

### 1. Lógica pesada dentro de hook

**❌ Errado:**
```ts
hooks: {
  onHit: (key) => {
    // Isso roda TODA VEZ QUE HIT!
    const expensive = JSON.parse(JSON.stringify(hugeObject));
    sendToAnalytics(expensive);
  },
}
```

**✅ Correto:**
```ts
hooks: {
  onHit: (key) => {
    // Apenas algo leve
    metrics.recordHit();
  },
}
```

### 2. Hooks em produção ligados

**❌ Errado:**
```ts
const cache = new Cache({
  hooks: {
    onHit: (k) => console.log("HIT", k), // Console.log em prod?
  }
});
```

**✅ Correto:**
```ts
const cache = new Cache({
  hooks: process.env.NODE_ENV === "development" ? {
    onHit: (k) => console.log("HIT", k),
  } : undefined,
});
```

## 💡 Boas práticas

1. **Use apenas em desenvolvimento:**
```ts
const cache = new Cache<T>({
  hooks: isDevelopment ? {
    onHit: (key) => console.log("HIT:", key),
    onMiss: (key) => console.log("MISS:", key),
  } : undefined,
});
```

2. **Combine com `onEvent` para produção:**
```ts
const cache = new Cache<T>({
  onEvent: (event) => {
    if (process.env.NODE_ENV === "production") {
      logger.debug("Cache event", event.type);
    }
  },
});
```

## Disponíveis

- `onHit?: (key) => void` - Quando cache retorna valor válido
- `onMiss?: (key) => void` - Quando cache não encontra
- `onSet?: (key, value, ttl) => void` - Quando valor é armazenado
- `onDelete?: (key) => void` - Quando valor é removido
- `onRefresh?: (key) => void` - Quando valor é atualizado

## Ver também

- [config options](/docs/api/config-options) - Todas as configurações
- [Cache](/docs/api/cache) - Classe principal
