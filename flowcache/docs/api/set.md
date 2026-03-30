---
title: set
---

# set

## 🧠 O que é

`set` armazena um valor no cache associado a uma chave com TTL e tags opcionais.

## ❓ Por que existe

Quando você quer **armazenar um valor conhecido** sem executar nenhuma função async.

## ✅ Quando usar

- Pré-popular cache ("warming").
- Armazenar resultado de operação síncrona.
- Cachear configurações carregadas na inicialização.
- Manualmente atualizar cache após mudança.

## 🚫 Quando NÃO usar

- Para a maioria dos casos reais: use `fetch` (mais idiomático).

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();
cache.set("msg", "Olá", { ttl: 5_000 });

const msg = cache.get("msg");
console.log(msg); // "Olá"
```

## 🧩 Exemplo real de produção

```ts
type AppConfig = { apiUrl: string; version: string; features: string[] };
const configCache = new Cache<AppConfig>();

// No boot da aplicação
export async function initializeApp() {
  const config = await fetch("/api/config").then(r => r.json());
  
  // Pré-popular cache
  configCache.set("app:config", config, {
    ttl: 10 * 60_000,  // Válido por 10 minutos
    tags: ["config"],  // Para invalidar depois
  });
  
  return config;
}

// Mais tarde
export function getAppConfig(): AppConfig | null {
  return configCache.get("app:config");
}

// Quando config mudar
export async function reloadConfig() {
  const newConfig = await fetch("/api/config").then(r => r.json());
  configCache.set("app:config", newConfig, { ttl: 10 * 60_000, tags: ["config"] });
}
```

## ⚠️ Erros comuns

### 1. Armazenar um valor gigante

**❌ Errado:**
```ts
const hugeArray = new Array(10_000_000).fill({...});
cache.set("huge", hugeArray); // Estoura memória!
```

**✅ Correto:**
```ts
// Armazene apenas dados necessários
cache.set("small", { id: 1, name: "Alice" });
```

### 2. Esquecer TTL

**❌ Errado:**
```ts
cache.set("user", userData); // Usa defaultTTL
// Se defaultTTL for 5min e nunca muda: dados desatualizados
```

**✅ Correto:**
```ts
cache.set("user", userData, { ttl: 30_000 }); // Explicitamente 30s
```

## 💡 Boas práticas

1. **Sempre use tags:**
```ts
cache.set("config", data, {
  ttl: 5 * 60_000,
  tags: ["config", "app:settings"],
});
```

2. **Padronize nomes de chave:**
```ts
// Bom
cache.set("user:123:settings", {...});
cache.set("post:456:comments", {...});

// Ruim
cache.set("data", {...});
cache.set("tmp", {...});
```

3. **Considere usar `fetch` em vez de `set`:**
```ts
// Ao invés de:
const data = await loadData();
cache.set("data", data);

// Prefira:
await cache.fetch("data", loadData);
```

## Ver também

- [get](/docs/api/get) - Ler valor
- [fetch](/docs/api/fetch) - Método principal
