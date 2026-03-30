---
title: Debug e Observabilidade
---

# Debug e Observabilidade

## 🧠 O Objetivo

Entender o que cache está fazendo: hits? misses? deduplicação funcionando? Sem observabilidade, você tira conclusões erradas.

## ❓ Por que existe

- Cache é "caixa preta" sem outputs
- Hit rate baixo pode significar:
  - TTL muito baixo
  - Chave incorreta
  - Dados muito dinâmicos
- Sem debugging, nunca você descobre

## ✅ Quando usar

- Desenvolvimento
- Produção (monitoramento)
- Debug de performance

## 🚫 Quando NÃO usar

- Logging excessivo em produção (mata performance)
- Dados sensíveis nos logs

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "omnicache";

const cache = createCache<any>({
  defaultTTL: 10_000,
  // Log cada evento (desenvolvimento)
  onEvent: (event) => {
    console.log(`[CACHE:${event.type}] ${event.key}`);
  },
});

// Monitor a cada 5 segundos
setInterval(() => {
  const stats = cache.stats();
  const hitRate = stats.hits / (stats.hits + stats.misses) || 0;
  console.log(`📊 Hit rate: ${(hitRate * 100).toFixed(1)}%`);
}, 5_000);

// Uso
cache.fetch("key1", async () => 1);
// Output: [CACHE:miss] key1
//         [CACHE:set] key1

// Próxima chamada
cache.fetch("key1", async () => 1);
// Output: [CACHE:hit] key1
```

## 🧩 Exemplo real: Production Monitoring

```ts
import { createCache } from "omnicache";

type AppMetrics = {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  pendingRequests: number;
  cacheSize: number;
};

type CacheEvent = {
  type: string;
  key?: string;
  timestamp: Date;
};

const cache = createCache<any>({
  defaultTTL: 30_000,
  
  onEvent: (event) => {
    // Em produção: enviar para observabilidade (Datadog, NewRelic, etc)
    if (process.env.NODE_ENV === "production") {
      sendToMonitoring({
        type: event.type,
        key: event.key,
        timestamp: new Date(),
      });
    } else {
      console.log(`[${event.type}] ${event.key}`);
    }
  },
  
  hooks: {
    onHit: (key) => {
      if (process.env.DEBUG_CACHE) {
        console.log(`✅ HIT: ${key}`);
      }
    },
    onMiss: (key) => {
      if (process.env.DEBUG_CACHE) {
        console.log(`❌ MISS: ${key}`);
      }
    },
  },
});

// Monitoramento periódico
function monitorCache() {
  const stats = cache.stats();
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 
    ? (stats.hits / totalRequests * 100).toFixed(1) 
    : "N/A";

  const metrics: AppMetrics = {
    hitRate: parseFloat(hitRate as string) || 0,
    missRate: parseFloat((100 - parseFloat(hitRate as string)).toFixed(1)) || 100,
    avgResponseTime: 0,  // Calculado separadamente
    pendingRequests: stats.pending,
    cacheSize: stats.size,
  };

  return metrics;
}

// Emissão em tempo real
setInterval(() => {
  const metrics = monitorCache();
  
  if (process.env.NODE_ENV === "production") {
    // Enviar pra Prometheus, CloudWatch, etc
    sendMetrics({
      "cache.hit_rate": metrics.hitRate,
      "cache.miss_rate": metrics.missRate,
      "cache.size": metrics.cacheSize,
      "cache.pending": metrics.pendingRequests,
    });
  } else {
    console.table(metrics);
  }
}, 60_000);  // A cada minuto

// Alertar se hit rate baixo
function checkCacheHealth() {
  const stats = cache.stats();
  const hitRate = stats.hits / (stats.hits + stats.misses);
  
  if (hitRate < 0.5) {  // < 50%
    console.warn("⚠️  ALERT: Cache hit rate é baixo!");
    console.warn(`   Hit rate: ${(hitRate * 100).toFixed(1)}%`);
    console.warn(`   Causas possíveis:");
    console.warn(`   1. TTL muito baixo (${cache.config().defaultTTL}ms)");
    console.warn(`   2. Chaves incorretas (mudam a cada requisição)");
    console.warn(`   3. Dados muito dinâmicos");
  }
  
  if (stats.pending > 100) {
    console.warn("⚠️  ALERT: Muitas promises pendentes!");
    console.warn(`   Pending: ${stats.pending}");
    console.warn(`   Causas possíveis:");
    console.warn(`   1. Upstream lento");
    console.warn(`   2. Timeout insuficiente");
  }
}

setInterval(checkCacheHealth, 30_000);

// Endpoint de debug
app.get("/api/admin/cache-debug", (req, res) => {
  const stats = cache.stats();
  res.json({
    stats,
    metrics: monitorCache(),
    health: stats.hits / (stats.hits + stats.misses) > 0.5 ? "✅ OK" : "❌ PROBLEMA",
  });
});
```

## ⚠️ Erros comuns

### Erro 1: Logging demais em produção

```ts
// ❌ Perigoso: Cada event causa filesystem I/O
onEvent: (event) => {
  console.log(`[CACHE] ${event.type} ${event.key}`);  // Muito!
  // 1000 events/s = 1000 logs/s = performance péssima
}

// ✅ Melhor: Batch ou amostrar
let eventCount = 0;
setInterval(() => {
  if (eventCount > 100) {
    console.log(`Cache: ${eventCount} events no último minuto`);
    eventCount = 0;
  }
}, 60_000);

onEvent: (event) => {
  eventCount++;
}
```

### Erro 2: Interpretar errado

```ts
// ❌ Errado: "Hit rate 50%, aumentar TTL"
// Pode ser:
// - Chave muda por timestamp
// - 1000 usuários, cache máximo 500 entradas
// - Dados muito dinâmicos

// ✅ Antes de mudar TTL:
// 1. Verificar chave (não tem Date.now()? timestamp?)
// 2. Verificar maxEntries vs número de dados únicos
// 3. Verificar se dados realmente são dinâmicos
```

### Erro 3: Sem thresholds de alerta

```ts
// ❌ Sem alert:
setInterval(() => {
  console.log(cache.stats());  // Imprime, mas não alerta
}, 60_000);

// ✅ Com alert:
setInterval(() => {
  const stats = cache.stats();
  const hitRate = stats.hits / (stats.hits + stats.misses);
  
  if (hitRate < 0.3) {
    sendAlert("Cache hit rate crítico: " + hitRate);
  }
}, 60_000);
```

## 💡 Boas práticas

### 1. Desenvolvimento: Verbose logging

```ts
const cache = createCache({
  onEvent: (event) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[CACHE:${event.type}] ${event.key}`);
    }
  },
});
```

### 2. Produção: Métricas agregadas

```ts
setInterval(() => {
  const stats = cache.stats();
  const metric = {
    timestamp: new Date(),
    hitRate: stats.hits / (stats.hits + stats.misses),
    size: stats.size,
    pending: stats.pending,
  };
  
  // Enviar para observabilidade
  observability.gauge("cache.hit_rate", metric.hitRate);
  observability.gauge("cache.size", metric.size);
}, 60_000);
```

### 3. Monitorar deduplicação

```ts
const stats = cache.stats();
const dedup = stats.pending;  // Requisições dedup'd que estão aguardando

if (dedup > 50) {
  console.log(`✅ Dedup funcionando: ${dedup} requests compartilhando 1 fetch`);
}
```

### 4. Debug de chave

```ts
// Para encontrar typo em chave:
const keys = new Set<string>();

onEvent: (event) => {
  if (event.key) keys.add(event.key);
}

// Depois:
console.log("Cache keys:", Array.from(keys).sort());
// Procura por patterns estranhos
```

## 📊 Checklist de debugging

| Sintoma | Causa provável | Solução |
|---------|----------|----------|
| Hit rate < 30% | Chave muda | Remover timestamp/random |
| Hit rate < 50% | TTL baixo | Aumentar TTL |
| Hit rate < 70% | maxEntries cheio | Aumentar ou diminuir dados |
| Pending alto (> 100) | Upstream lento | Aumentar timeout |
| Memory cresce | Sem dispose/sweep | Adicionar sweepIntervalMs |

## 🔗 Próximos passos

- [Performance](/docs/performance-boas-praticas) - Monitoramento avançado
- [API: hooks](/docs/api/hooks) - Documentação de callbacks
- [API: stats](/docs/api/stats) - Métodos de estatísticas
