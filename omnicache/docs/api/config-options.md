---
title: config options
---

# config options

## 🧠 O que é

Opções para customizar comportamento do Cache no construtor.

## ❓ Por que existe

Diferentes casos de uso exigem diferentes trade-offs entre memória, velocidade e controle.

## ✅ Quando usar

Sempre: use constructor para configurar seu cache.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>({
  defaultTTL: 60_000,
});
```

## 🧩 Exemplo real de produção

```ts
type ApiResponse = { data: any };
const apiCache = new Cache<ApiResponse>({
  // TTL padrão em ms (5 min = 5 * 60 * 1000)
  defaultTTL: 5 * 60 * 1000,
  
  // Limite de entradas (remove antigas se exceder)
  maxEntries: 10_000,
  
  // Tempo máximo de promise pendente (evita memory leak)
  maxPendingAgeMs: 30_000,
  
  // Limpeza automática de expirados (a cada X ms)
  sweepIntervalMs: 60_000,
  
  // Callbacks de eventos
  hooks: {
    onHit: (key) => metrics.hit(),
    onMiss: (key) => metrics.miss(),
  },
  
  // Stream de eventos para produção
  onEvent: (event) => {
    if (event.type === "sweep") {
      logger.debug(`Sweep removed ${event.removed} entries`);
    }
  },
});
```

## 📋 Todas as opções

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `defaultTTL` | number | 5 * 60 * 1000 (5min) | TTL padrão em ms |
| `maxEntries` | number | 10_000 | Limite de entradas antes de evict |
| `maxPendingAgeMs` | number | 30_000 | Tempo máx de promise pendente |
| `sweepIntervalMs` | number | undefined | Intervalo de limpeza automática |
| `hooks` | `CacheHooks` | undefined | Callbacks de eventos |
| `onEvent` | function | undefined | Stream de eventos |

## ⚠️ Erros comuns

### 1. TTL muito pequeno

**❌ Errado:**
```ts
const cache = new Cache({ defaultTTL: 100 }); // 100ms!
// Cache expira muito rápido, cache hit quase nunca
```

**✅ Correto:**
```ts
const cache = new Cache({ defaultTTL: 30_000 }); // 30s
```

### 2. maxEntries muito alto

**❌ Errado:**
```ts
const cache = new Cache({ maxEntries: 1_000_000 });
// Pode consumir memória descontroladamente
```

**✅ Correto:**
```ts
const cache = new Cache({ maxEntries: 5_000 });
// Realista para maioria das aplicações
```

### 3. Esquecer de chamar `dispose()` com `sweepIntervalMs`

**❌ Errado:**
```ts
const cache = new Cache({ sweepIntervalMs: 10_000 });
// Timer rodando indefinidamente
```

**✅ Correto:**
```ts
const cache = new Cache({ sweepIntervalMs: 10_000 });
process.on("exit", () => cache.dispose());
```

## 💡 Boas práticas

1. **Escolha TTL baseado em tipo de dado:**
```ts
//5-15s: Dados muito dinâmicos
new Cache({ defaultTTL: 10_000 });

// 30-120s: APIs externas
new Cache({ defaultTTL: 60_000 });

// 5min+: Configurações
new Cache({ defaultTTL: 5 * 60_000 });
```

2. **Configure `maxEntries` conservativo:**
```ts
// Para maioria dos casos
new Cache({ maxEntries: 5_000 });

// Se muitos usuários simultâneos
new Cache({ maxEntries: 50_000 });
```

3. **Ative `sweepIntervalMs` em processos de longa vida:**
```ts
// Bot Discord, API server
new Cache({
  defaultTTL: 30_000,
  sweepIntervalMs: 60_000, // Limpe a cada 1 minuto
});
```

## Ver também

- [Cache](/docs/api/cache) - Classe principal
- [hooks](/docs/api/hooks) - Callbacks de eventos
