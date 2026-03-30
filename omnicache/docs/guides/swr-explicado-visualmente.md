---
title: SWR Explicado Visualmente
---

# SWR Explicado Visualmente

## 🧠 O que é SWR

SWR (Stale-While-Revalidate) = "retorna o antigo enquanto busca o novo". Usuário vê dados em **1ms** (rápido), recebe atualização em background.

## ❓ Por que existe

- APIs externas são lentas (200-500ms)
- User experience horrível se espera sempre
- SWR: retorna cache antigo rápido + atualiza em background
- Melhor UX que garantir dados 100% frescos

## ✅ Quando usar

- Dados não críticos (um pouco antigo é ok)
- Latência importa mais que freshness
- Dashboard, feed, listas

## 🚫 Quando NÃO usar

- Dados críticos (saldo bancário, pricecheck)
- Dados que mudam a cada segundo
- Transações financeiras

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "omnicache";

const cache = createCache<any>({
  defaultTTL: 10_000,  // 10 segundos
});

export async function getDashboard() {
  return cache.fetch(
    "dashboard",
    async () => {
      const res = await fetch("/api/dashboard");  // Lento: 300ms
      return res.json();
    },
    {
      stale: true,  // 👈 SWR ativa!
    }
  );
}

// Sem SWR: espera 300ms
const data = await getDashboard();  // 300ms

// Com SWR: retorna em 1ms + atualiza em background
const data = await getDashboard();  // 1ms (retorna cache antigo)
// Em background: busca novo, próxima chamada estará fresca
```

## 📊 Timeline Visual

```
t=0s       t=5s       t=10s      t=15s      t=20s
|----------|----------|----------|----------|-------

Sem SWR (fetch normal):
┌─ Call 1 ─┐
│ fetch()  │──300ms──> [retorna]
└──────────┘
     ▲
   cache
     ▼
┌─ Call 2 ─┐
│ cache    │──1ms──> [retorna]
└──────────┘
     ▲
   cache válido (9s)
     ▼
┌─ Call 3 ─┐
│ cache    │──1ms──> [retorna]
└──────────┘
     ▲
   cache válido (4s)
     ▼
┌─ Call 4 ─┐
│ EXPIROU! │──300ms──> [refazer fetch] ❌ LENTO!
│ fetch()  │
└──────────┘


Com SWR (stale: true):
┌─ Call 1 ─┐
│ fetch()  │──300ms──> [retorna] [grava cache]
└──────────┘
     ▲
   cache
     ▼
┌─ Call 2 ─┐           Fresh ✅
│ cache    │──1ms──> [retorna] (9s válido)
└──────────┘
     ▲
     ▼
┌─ Call 3 ─┐           Fresh ✅
│ cache    │──1ms──> [retorna] (4s válido)
└──────────┘
     ▲
     ▼
┌─ Call 4 ─┐           ⚠️ Stale, mas retorna rápido!
│ cache    │──1ms──> [retorna antigo]  Stale ⚠️
│ +        │         [background fetch...]
│ fetch()  │         [300ms depois: atualiza]
└──────────┘

┌─ Call 5 ─┐           Fresh ✅ (background terminou)
│ cache    │──1ms──> [retorna novo]
└──────────┘
```

## 🧩 Exemplo real: Dashboard de Analytics

```ts
import { createCache } from "omnicache";

type DashboardData = {
  totalUsers: number;
  activeToday: number;
  revenue: number;
  conversionRate: number;
  lastUpdate: Date;
};

const dashCache = createCache<DashboardData>({
  defaultTTL: 30_000,  // 30 segundos
});

async function fetchDashboardData(): Promise<DashboardData> {
  console.log("📊 Fetching dashboard from database...");
  const res = await fetch("/api/admin/dashboard");
  
  return {
    ...(await res.json()),
    lastUpdate: new Date(),
  };
}

export async function getDashboard(): Promise<DashboardData> {
  return dashCache.fetch(
    "dashboard",
    fetchDashboardData,
    {
      stale: true,  // 👈 SWR ativa
      ttl: 30_000,
    }
  );
}

// API endpoint
app.get("/api/admin/dashboard", async (req, res) => {
  const start = Date.now();
  const dashboard = await getDashboard();
  const ms = Date.now() - start;
  
  res.json({
    ...dashboard,
    responseTime: ms,  // Mostra se foi cache (1ms) ou fetch (300ms+)
  });
});
```

### Real-world scenario:

```
t=0:    Admin abre dashboard
        → dashCache.fetch()
        → [MISS] Começa fetch ao DB (300ms)
        → Response: { totalUsers: 1000, activeToday: 250, ... }
        → Grava em cache

t=5s:   Admin atualiza página
        → dashCache.fetch()
        → [HIT] Retorna cache em 1ms
        → Response: { totalUsers: 1000, activeToday: 250, ... }
        → lastUpdate: 5s atrás

t=30s:  Admin atualiza página novamente
        → dashCache.fetch()
        → [STALE HIT] Retorna cache em 1ms
        → Response: { totalUsers: 1000, activeToday: 250, ... } ✅ Mesmos dados!
        → Background: começa fetch novo (300ms)

t=30.3s: Fetch background completa
         → { totalUsers: 1005, activeToday: 260, ... } ← NOVO
         → Grava em cache

t=31s:  Admin atualiza página NOVAMENTE
        → dashCache.fetch()
        → [HIT] Retorna cache novo em 1ms
        → Response: { totalUsers: 1005, activeToday: 260, ... } ✅ ATUALIZADO
        → lastUpdate: apenas 1s atrás
```

## ⚠️ Erros comuns

### Erro 1: Sem `stale: true`

```ts
// ❌ Sem SWR: trava esperando pelo background
const data = await cache.fetch(
  key,
  slowFetch,
  { /* stale: false por padrão */ }
);
// t=31s: Cache expirou → espera 300ms pelo fetch ❌

// ✅ Com SWR: retorna rápido
const data = await cache.fetch(
  key,
  slowFetch,
  { stale: true }  // 👈 Ativa
);
// t=31s: Cache expirou → retorna em 1ms ✅
//        + background refaz em paralelo
```

### Erro 2: Dados críticos com SWR

```ts
// ❌ Perigoso: Mostrar saldo antigo
export async function getBalance(userId: string) {
  return balanceCache.fetch(
    `user:${userId}:balance`,
    fetchFromDB,
    { stale: true }  // ❌ Pode mostrar dados de HORAS atrás!
  );
}

// ✅ Sem SWR para dados críticos
export async function getBalance(userId: string) {
  return balanceCache.fetch(
    `user:${userId}:balance`,
    fetchFromDB,
    { stale: false }  // Sempre fresh!
  );
}
```

### Erro 3: TTL muito curto

```ts
// ❌ Ruim: Cache expira muito rápido
const cache = createCache({ defaultTTL: 1_000 });  // 1s
// SWR não tem tempo pra trabalhar, está sempre refazendo

// ✅ Melhor:
const cache = createCache({ defaultTTL: 30_000 });  // 30s
// Dá tempo pra SWR fazer seu trabalho (refazer em background)
```

## 💡 Boas práticas

### 1. Use SWR em dashboards

```ts
return cache.fetch(key, fetch, {
  stale: true,  // User vê dados rápido
  ttl: 30_000,  // Atualiza a cada 30s em background
});
```

### 2. Não use SWR em dados críticos

```ts
// Dados críticos = sem SWR
return cache.fetch(key, fetch, {
  stale: false,  // Sempre fresh!
  ttl: 60_000,
});
```

### 3. Monitorar se SWR está ativo

```ts
setInterval(() => {
  const stats = cache.stats();
  const staleHits = stats.hits - stats.immediate;  // Apróximado
  
  if (staleHits > 0) {
    console.log(`✅ SWR está funcionando: ${staleHits} stale hits`);
  }
}, 60_000);
```

## 🔗 Próximos passos

- [Performance](/docs/performance-boas-praticas) - TTL vs latency trade-offs
- [Conceitos Principais](/docs/conceitos-principais) - Como funciona internamente
- [API: fetch](/docs/api/fetch) - Opções do método fetch
