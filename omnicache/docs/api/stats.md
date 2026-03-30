---
title: stats
---

# stats

## 🧠 O que é

`stats` retorna métrica de uso do cache: quantidade de hits, misses, stale hits, entries e promises pendentes.

## ❓ Por que existe

Para monitorar e debugar a efetividade do cache em produção.

## ✅ Quando usar

- Monitoring/logging periódico.
- Debug: por que cache não está ajudando?
- Alertas: muitos misses? TTL errado? Chaves erradas?

## 🚫 Quando NÃO usar

- Em produção sem estrutura de logging.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<number>();

cache.set("a", 1);
cache.get("a"); // hit
cache.get("b"); // miss

console.log(cache.stats());
// { hits: 1, misses: 1, staleHits: 0, pending: 0, size: 1 }
```

## 🧩 Exemplo real de produção

```ts
const cache = new Cache<any>({ defaultTTL: 30_000 });

// Log stats a cada minuto
setInterval(() => {
  const stats = cache.stats();
  const hitRate = stats.hits / (stats.hits + stats.misses) * 100 || 0;
  
  console.log({
    hitRate: `${hitRate.toFixed(1)}%`,
    hits: stats.hits,
    misses: stats.misses,
    staleHits: stats.staleHits,
    pending: stats.pending,
    size: stats.size,
  });
}, 60_000);

// Alertar se hit rate muito baixo
if (hitRate < 30) {
  console.warn("⚠️  Cache hit rate baixo! Revisar TTL ou chaves");
}
```

## ⚠️ Erros comuns

### 1. Assumir que `hits/misses` são filtrados por prefixo

**❌ Errado:**
```ts
const stats = cache.stats("user:");
// stats.hits refere-se a TODOS os hits, não apenas "user:..."
```

**✅ Correto:**
```ts
const stats = cache.stats("user:");
// stats.pending e stats.size SÃO filtrados por prefixo
// Mais hits/misses são globais
```

## 💡 Boas práticas

1. **Logie stats regularmente:**
```ts
setInterval(() => {
  console.log("Cache Stats:", cache.stats());
}, 60_000);
```

2. **Use `stats` para diagnosticar problemas:**
```ts
// Se misses muito alto:
// - TTL muito baixo?
// - Chave muda demais entre chamadas?
const stats = cache.stats();
if (stats.misses > stats.hits * 2) {
  console.warn("Muitos misses! Revisar arquitetura");
}
```

## Ver também

- [Cache](/docs/api/cache) - Classe principal
