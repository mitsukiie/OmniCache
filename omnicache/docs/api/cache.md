---
title: Cache
---

# Cache

## 🧠 O que é

A classe `Cache<T>` é a classe principal de OmniCache. Ela é um armazenador tipado de dados em memória que:
- Guarda valores por chave com expiração automática (TTL).
- Deduplica promises simultâneas para a mesma chave.
- Oferece invalidatação granular por prefixo/tag.
- Emite eventos e hooks para observabilidade.

## ❓ Por que existe

Você precisa de uma abstracão que:
1. Não requer serviço externo (Redis) para cache local.
2. Automatiza deduplicatação quando múltiplas requisições chegam juntas.
3. Evita boilerplate de "se existe, retorna; senão, carrega".
4. Tipagem forte (especialmente em TypeScript).

## ✅ Quando usar

- Cada vez que vocé consulta dados que mudam lentamente.
- Em Bots (Discord, Telegram) que processam comandos repetidos.
- Em Dashboards/APIs internas onde latência é crítica.
- Quando você quer evitar sobrecarga no upstream.

## 🚫 Quando NÃO usar

- Para cache distribuido entre processos (use Redis).
- Para dados que devem sobreviver a restart (use banco).
- Para dados com consistência forte obrigatória.
- Para valores gigantescos (podem estourar memória).

## ⚡ Exemplo mínimo funcional

```ts
import { Cache } from "omnicache";

// Criar instância
const cache = new Cache<{ greeting: string }>({
  defaultTTL: 5_000,
});

// Usar
await cache.set("hello", { greeting: "World" }, { ttl: 5_000 });
const result = cache.get("hello");
console.log(result); // { greeting: "World" }
```

## 🧩 Exemplo real de produção

```ts
import { Cache } from "omnicache";

type GithubRepo = {
  id: number;
  full_name: string;
  stars: number;
};

// Instancia global com configuração realista
const githubCache = new Cache<GithubRepo>({
  defaultTTL: 60_000,         // 1 minuto → dados não muito desatualizados
  maxEntries: 500,            // Limite de memória
  maxPendingAgeMs: 30_000,    // Promises antigas limpas automáticamente
  sweepIntervalMs: 60_000,    // Limpeza periódica
  hooks: {
    onHit: (key) => console.log("[CACHE HIT]", key),
    onMiss: (key) => console.log("[CACHE MISS]", key),
    onDelete: (key) => console.log("[CACHE DELETE]", key),
  },
  onEvent: (event) => {
    if (event.type === "sweep") {
      console.log(`[SWEEP] Removido ${event.removed} entradas");
    }
  },
});

// Método principal: fetch com deduplicatação automática
export async function getGithubRepo(owner: string, repo: string): Promise<GithubRepo> {
  const key = `github:${owner}:${repo}`;
  
  return githubCache.fetch(
    key,
    async () => {
      console.log(`🔡 Consultando GitHub API para ${owner}/${repo}...`);
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      return res.json() as Promise<GithubRepo>;
    },
    {
      stale: true,                    // SWR: retorna antigo + atualiza
      tags: ["github", `owner:${owner}`],
    }
  );
}

// Stats para monitoramento
export function getStats() {
  return githubCache.stats();
}

// Limpeza manual
export function clearOwnerCache(owner: string) {
  return githubCache.invalidateTag(`owner:${owner}`);
}
```

## ⚠️ Erros comuns

### 1. Usar `Cache<any>` e perder tipagem

**❌ Errado:**
```ts
const cache = new Cache(); // Tipo é Cache<unknown>
const data = cache.get("key");
// data é any → nenhum erro de tipo detectado
```

**✅ Correto:**
```ts
type User = { id: string; name: string };
const cache = new Cache<User>();
const data = cache.get("key");
// data é User | null → propriedades são verificadas
```

### 2. Esquecer de chamar `dispose()` com `sweepIntervalMs`

**❌ Errado:**
```ts
const cache = new Cache({ sweepIntervalMs: 10_000 });
// Timer rodando indefinidamente, mesmo se cache não é mais usado
```

**✅ Correto:**
```ts
const cache = new Cache({ sweepIntervalMs: 10_000 });

// No final da aplicação ou cleanup
process.on("exit", () => cache.dispose());
```

### 3. Sobrecarregar `maxEntries` muito alto

**❌ Errado:**
```ts
const cache = new Cache({ maxEntries: 1_000_000 }); // 1 milhão!
// Pode consumir mémria descontrolada
```

**✅ Correto:**
```ts
const cache = new Cache({ maxEntries: 5_000 }); // Realista
// Remove entradas antigas se exceder
```

## 💡 Boas práticas

### 1. Tipo sempre tipado
```ts
type CacheType = { id: string; data: string };
const cache = new Cache<CacheType>(); // Sempre tipo explícito
```

### 2. Comece com valores padrão e ajuste
```ts
const cache = new Cache<T>({
  defaultTTL: 30_000,      // 30s é bom começo
  maxEntries: 5_000,       // Realista para maioria dos casos
  sweepIntervalMs: 60_000, // Limpe a cada 1 minuto
});
```

### 3. Configure hooks apenas em desenvolvimento
```ts
const cache = new Cache<T>({
  hooks: process.env.NODE_ENV === "development" ? {
    onHit: (k) => console.log("HIT", k),
    onMiss: (k) => console.log("MISS", k),
  } : undefined,
});
```

### 4. Use tags para invalidatação lógica
```ts
// Não facça:
await cache.fetch(key1, fn1);
await cache.fetch(key2, fn2);
// depois: cache.delete(key1); cache.delete(key2);

// Faça:
await cache.fetch(key1, fn1, { tags: ["user-data"] });
await cache.fetch(key2, fn2, { tags: ["user-data"] });
// depois: cache.invalidateTag("user-data"); // Remove ambas
```

### 5. Monitore `pending` para detectar travamentos
```ts
setInterval(() => {
  const stats = cache.stats();
  if (stats.pending > 100) {
    console.warn("Múltiplas promises pendentes!", stats.pending);
  }
}, 30_000);
```

## Construtor TypeScript

```ts
class Cache<T> {
  // Opção 1: TTL simples
  constructor(defaultTTL?: number);
  
  // Opção 2: Configuração completa
  constructor(config?: CacheConfig<T>);
}
```

## Ver também

- [fetch](/docs/api/fetch) - Principal método de uso
- [set/get](/docs/api/set) - Operações diretas
- [refresh](/docs/api/refresh) - Forçar atualização
- [config options](/docs/api/config-options) - Todas as configurações
