---
title: fetch
---

# fetch

## 🧠 O que é

`fetch` é o **método principal** de FlowCache. Ele:
1. Verifica se uma chave existe em cache e é válida.
2. Se existe, retorna instantaneamente.
3. Se não existe, executa sua função async.
4. Deduplica: se múltiplas chamadas chegarem juntas, apenas 1 função executa.
5. Guarda resultado com TTL.

## ❓ Por que existe

Sem isso, vocæ teria que escrever manualmente:
```ts
// Boilerplate repetitivo
let cached;
async function getData() {
  if (cached && !isExpired(cached)) return cached.value;
  const data = await fetch(...);
  cached = { value: data, expiredAt: ... };
  return data;
}
```

`fetch` encapsula tudo isso com deduplicatação de brinde.

## ✅ Quando usar

- Sempre que você chama uma operação lenta (API, banco, cálculo).
- Quando múltiplos clientes pedein os mesmos dados simultaneamente.
- Para qualquer conteúdo que mudar apenas ocasionalmente.

## 🚫 Quando NÃO usar

- Para dados que mudam a cada microsegundo (use sem cache).
- Para operações críticas onde meia-segundo de atraso importa.
- Para valores gigantescos que não cabem em memória.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();

const result = await cache.fetch(
  "minha-chave",
  async () => "valor calculado"
);

console.log(result); // "valor calculado"
```

**O que acontece:**
1. FlowCache verifica se "minha-chave" existe.
2. Não existe → executa função async.
3. Guarda resultado com TTL padrão (5 minutos).
4. Retorna "valor calculado".

## 🧩 Exemplo real de produção

Situação: um bot Discord que consulta dados de jogador de uma API externa.

```ts
import { Cache } from "flowcache";

type PlayerData = {
  id: string;
  name: string;
  level: number;
  score: number;
  lastSeen: string;
};

const playerCache = new Cache<PlayerData>({
  defaultTTL: 30_000,  // 30 segundos
});

export async function getPlayerData(playerId: string): Promise<PlayerData> {
  return playerCache.fetch(
    `player:${playerId}`,  // Chave única por jogador
    async () => {
      // Só executada se cache vazio ou expirou
      console.log(`🔡 Buscando dados do jogador ${playerId}...`);
      
      const response = await fetch(
        `https://api.game.com/players/${playerId}`,
        { timeout: 5_000 }
      );
      
      if (!response.ok) {
        throw new Error(`API HTTP ${response.status}`);
      }
      
      return response.json() as Promise<PlayerData>;
    },
    {
      // Opções
      stale: true,  // Se expirar, retorna antigo + atualiza background
      tags: \["player\", `player:${playerId}`],  // Para invalidatação
    }
  );
}

// Uso
export async function handlePlayerCommand(discordUserId: string) {
  try {
    const player = await getPlayerData(discordUserId);
    return `Nome: ${player.name}, Nível: ${player.level}`;
  } catch (error) {
    return "Failed to fetch player data";
  }
}
```

## ⚠️ Erros comuns

### 1. Chave que não inclui dados

**❌ Errado:**
```ts
await cache.fetch("user", async () => getUser(userId));
// Todos os usuários compartilham a mesma chave!
// Chamadas subsequentes retornam primeiro usuário
```

**✅ Correto:**
```ts
await cache.fetch(`user:${userId}`, async () => getUser(userId));
// Cada usuário tem uma chave única
```

### 2. Não tratar erros de função

**❌ Errado:**
```ts
const result = await cache.fetch("data", async () => {
  // Se fetch("api") falhar, erro não é capturado
  return fetch("api").then(r => r.json());
});
```

**✅ Correto:**
```ts
try {
  const result = await cache.fetch("data", async () => {
    const res = await fetch("api");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
} catch (error) {
  console.error("Fetch falhou:", error);
}
```

### 3. Usar `stale: true` sem entender comportamento

**❌ Errado:**
```ts
// Espera dados SEMPRE frescos
await cache.fetch(key, fn, { stale: true, ttl: 10_000 });
// Mas stale retorna antigo por até 10 segundos!
```

**✅ Correto:**
```ts
// Documente que dados podem ser "levemente desatualizados"
await cache.fetch(key, fn, { stale: true, ttl: 10_000 });
// Aceite 10s de atraso em background
```

## 💡 Boas práticas

### 1. Chaves sempre com prefixo e ID
```ts
// ✅ Bom
await cache.fetch(`user:${userId}`, ...)
await cache.fetch(`post:${postId}:comments:${limit}`, ...)
await cache.fetch(`config:${tenantId}:feature-flags`, ...)

// ❌ Ruim
await cache.fetch("user", ...)
await cache.fetch("data", ...)
```

### 2. TTL baseado no tipo de dado
```ts
// Dados de nível alto: refresh rápido
await cache.fetch(`exchange:usd-brl`, fn, { ttl: 30_000 });

// Dados estáticos: TTL longo
await cache.fetch(`config:db-version`, fn, { ttl: 5 * 60_000 });
```

### 3. Use tags para grupos relacionados
```ts
// Não: remova manualmente
// cache.delete(`post:1`); cache.delete(`post:2`);

// Sim: use tag
await cache.fetch(`post:1`, fn, { tags: ["posts"] });
await cache.fetch(`post:2`, fn, { tags: ["posts"] });
cache.invalidateTag("posts"); // Remove dois de uma vez
```

### 4. Combine SWR com TTL realista
```ts
// Estratégia boa para dashboards:
// - Retorna valor antigo em <1ms
// - Atualiza em background (200ms)
await cache.fetch(
  `dashboard:${userId}`,
  async () => loadDashboard(userId),
  {
    stale: true,
    ttl: 15_000,  // 15 segundos
  }
);
```

### 5. Registre chamadas para debug
```ts
export async function getUser(id: string) {
  return cache.fetch(
    `user:${id}`,
    async () => {
      console.log(`[FETCH] user:${id}`);
      return fetch(`/api/users/${id}`).then(r => r.json());
    },
    { ttl: 30_000 }
  );
}
// Output:
// [FETCH] user:1    <- primeira chamada (miss)
// (próximas chamadas não loggam = cache hit)
```

## Assinatura TypeScript

```ts
fetch(
  key: string,
  fn: () => Promise<T>,
  options?: Options
): Promise<T>

// Options
type Options = {
  ttl?: number;        // TTL em ms (pode sobrescrever defaultTTL)
  stale?: boolean;     // SWR: retorna antigo + atualiza background
  tags?: string[];     // Tags para invalidetarção em lote
};
```

## Ver também

- [refresh](/docs/api/refresh) - Forçar atualização manual
- [getOrFetch](/docs/api/get) - Alias para fetch
- [wrap](/docs/api/wrap) - Cria função cacheada
