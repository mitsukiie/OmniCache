---
title: Performance e Boas Práticas
---

# Performance e Boas Práticas

## 🎯 Estratégia de TTL

### Dados muito dinâmicos (mudam segundos)

```ts
const cache = new Cache({
  defaultTTL: 3_000,  // 3 segundos
});

await cache.fetch("temperature", getTemperature);
// Cache atualiza a cada 3s
```

### APIs externas normais

```ts
const apiCache = new Cache({
  defaultTTL: 30_000,  // 30 segundos
});

await apiCache.fetch("github:repo", getGithubRepo);
// Razoável para maioria das APIsExternas
```

### Configurações quase estáticas

```ts
const configCache = new Cache({
  defaultTTL: 5 * 60_000,  // 5 minutos ou mais
});

await configCache.fetch("app:config", loadConfig);
// Mudar raramente, cache longo é ok
```

## 💡 SWR para melhor UX

Quando latência importa mais que dados 100% fresh:

```ts
const dashboardCache = new Cache<Dashboard>({
  defaultTTL: 10_000,
  maxEntries: 1000,
});

export async function getDashboard(userId: string): Promise<Dashboard> {
  return dashboardCache.fetch(
    `dashboard:${userId}`,
    async () => {
      // Chamada lenta (200-500ms)
      const data = await fetch(`/api/dashboard/${userId}`);
      return data.json();
    },
    {
      stale: true,  // 👈 SWR ativa
      ttl: 10_000,
    }
  );
}

// Timeline:
// t=0: Primeira chamada → busca API (200ms)
// t=1-10: Chamadas → retornam cache (1ms)
// t=11: TTL expirou → retorna última versão (1ms) + busca em background
// t=11.5: Cache atualizado em background, próxima chamada vai ter versão nova
```

### Ganho prático

Sem SWR:
```
t=0:    Fetch começa (200ms de espera)
t=200:  Retorna
t=1-10: Cache (1ms)
t=11:   Fetch começa novamente (200ms de espera) ← LENTO
t=211:  Retorna
```

Com SWR:
```
t=0:    Fetch começa (200ms em background)
t=200:  Cache atualizado
t=1-10: Cache (1ms)
t=11:   Retorna antigo (1ms) ← RÁPIDO
        Background busca novo
t=11.5: Cache atualizado
```

## 🧠 Evitar Memory Leak

### Configure `maxEntries`

```ts
const cache = new Cache<any>({
  defaultTTL: 30_000,
  maxEntries: 5_000,  // Limite máximo
});

// Se exceder 5000 entradas:
// -> Remove entradas mais antigas automaticamente
```

### Use `sweepIntervalMs` em processos de longa vida

```ts
const cache = new Cache<any>({
  defaultTTL: 30_000,
  sweepIntervalMs: 60_000,  // Limpe expir ados a cada 1 minuto
});

// Sem sweep:
// Entradas expiradas ficam na memória indefinidamente

// Com sweep:
// Removidas a cada 60s, memória fico controlada
```

### Considere `maxPendingAgeMs`

```ts
const cache = new Cache<any>({
  maxPendingAgeMs: 30_000,  // Promises pendentes "morrem" após 30s
});

// Previne que promises travadas crescam indefinidamente
```

### Cleanup em shutdown

```ts
const cache = new Cache({
  sweepIntervalMs: 10_000,
});

process.on("exit", () => {
  cache.dispose();  // Param timer de sweep
  console.log("Cache finalizado");
});
```

## 📊 Monitorar e Debugar

### Log periódico

```ts
const cache = new Cache<any>({
  defaultTTL: 30_000,
});

setInterval(() => {
  const stats = cache.stats();
  console.log({
    hitRate: `${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)}%`,
    size: stats.size,
    pending: stats.pending,
  });
}, 60_000);

// Output a cada minuto:
// { hitRate: '85.5%', size: 342, pending: 2 }
```

### Alertar se hit rate baixo

```ts
const stats = cache.stats();
const hitRate = stats.hits / (stats.hits + stats.misses);

if (hitRate < 0.50) {  // < 50%
  console.warn("⚠️  Cache hit rate baixo!");
  console.warn("- TTL muito baixo?");
  console.warn("- Chave muda demais entre chamadas?");
}
```

### Alertar se pending muito alto

```ts
const stats = cache.stats();

if (stats.pending > 100) {
  console.warn("⚠️  Muitas promises pendentes!");
  console.warn("- Upstream lento?");
  console.warn("- Timeout insuficiente?");
}
```

## 🚀 Otimizações avançadas

### Pré-popular cache em boot

```ts
export async function initializeCache() {
  const config = await fetch("/api/config").then(r => r.json());
  cache.set("config", config, {
    ttl: 10 * 60_000,
    tags: ["config"],
  });
}

app.on("start", initializeCache);
```

### Cache warming para dados populares

```ts
const popularPostIds = ["1", "2", "3"];

for (const id of popularPostIds) {
  // Pré carregue em background
  getPost(id).catch(err => console.error(err));
}
```

###  Invalidação inteligente

```ts
// Ao invés de:
cache.delete(`post:1`);
cache.delete(`post:2`);
cache.delete(`post:3`);

// Use tags:
cache.invalidateTag("post");  // Remove todas de uma vez
```

## ✨ Boas práticas resumidas

1. **TTL apropriado** → dados dinâmicos: 3-15s; normais: 30-60s; estáticos: 5min+
2. **SWR sempre** → melhora UX em 10x para operações lentas
3. **Tags e prefixos** → invalidação eficiente
4. **Monitorar stats** → detectar problemas cedo
5. **Cleanup no shutdown** → evitar memory leak
6. **maxEntries finito** → limita memória usada
7. **sweepIntervalMs** → remove expirados periodicamente

Seguindo essas práticas, OmniCache vai eliminar 70-90% de latência desnecessária em sua app!
