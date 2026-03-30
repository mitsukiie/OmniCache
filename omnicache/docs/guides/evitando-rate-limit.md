---
title: Evitando Rate Limit
---

# Evitando Rate Limit

## 🧠 O Problema

API externa tem limite: ex GitHub = 60 reqs/hora (unauthenticated). Sem cache, seu app faz muitos requests simultâneos e leva ban.

## ❓ Por que existe

- APIs cobram por request
- APIs têm limite de taxa
- Requests simultâneos desperdiçam quota
- Deduplicação reduz requests para 1 (de 20!)

## ✅ Quando usar

- API com rate limit
- Muitos usuários acessando mesmo dado
- Dados que podem ser um pouco antigos

## 🚫 Quando NÃO usar

- Dados que PRECISAM ser 100% fresh agora
- Sem limite de taxa na API

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "omnicache";

type GitHubUser = {
  login: string;
  public_repos: número;
  followers: number;
};

const githubCache = createCache<GitHubUser>({
  defaultTTL: 20_000,  // 20 segundos
});

export async function getGitHubUser(login: string): Promise<GitHubUser> {
  return githubCache.fetch(
    `gh:user:${login}`,
    async () => {
      const res = await fetch(`https://api.github.com/users/${login}`);
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      return res.json();
    },
    { stale: true }  // SWR: retorna antigo rápido
  );
}

// Se 20 requests chegam juntas "getGitHubUser('torvalds')"
// OmniCache faz UMA chamada à API
// Todos 20 recebem mesma resposta
```

## 🧩 Exemplo real: Dashboard com deduplicação

Dashboard mostra top 10 developers. Se 100 users acessam simultaneamente:

```ts
import { createCache } from "omnicache";

type Developer = {
  login: string;
  public_repos: number;
  followers: number;
  bio: string;
};

const devCache = createCache<Developer>({
  defaultTTL: 30_000,      // 30 segundos
  maxEntries: 1000,
});

async function getDeveloper(login: string): Promise<Developer> {
  return devCache.fetch(
    `dev:${login}`,
    async () => {
      console.log(`🔄 Fetching ${login} from GitHub...`);
      const res = await fetch(`https://api.github.com/users/${login}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    { stale: true, tags: ["github", `github:user:${login}`] }
  );
}

// Dashboard endpoint
app.get("/api/top-developers", async (req, res) => {
  const topDevs = [
    "torvalds",
    "gvanrossum",
    "python",  // org
    "facebook",  // org
  ];

  // Se 100 users acessam ao mesmo tempo
  const developers = await Promise.all(
    topDevs.map(getDeveloper)
  );

  res.json({
    developers,
    cacheHitRate: devCache.stats().hits / (devCache.stats().hits + devCache.stats().misses),
  });
});

// Timeline de 100 requisições simultâneas
// t=0:    100 users acessam /api/top-developers
// t=0:    Primeiro user: cache miss → começa fetch de GitHub
// t=0-5:  99 users chegam → DEDUP (aguardam primeiro)
// t=300:  GitHub responde
// t=300:  Todos 100 users recebem resposta
// RESULTADO: 1 request GitHub ao invés de 100! ✅

// Com SWR, próxima onda de requests:
// t=31s:  TTL expirou  → retorna dado antigo (1ms)
//         + começa fetch em background
// t=31s+delta: próximas requests já têm valor novo
```

## ⚠️ Erros comuns

### Erro 1: Sem deduplicação

```ts
// ❌ Ruim: Cada request dispara API
export async function getUser(login: string) {
  // Sem cache, só fetch direto
  return fetch(`https://api.github.com/users/${login}`).then(r => r.json());
}

// 100 requisições simultâneas = 100 requests à API
// Rate limit: 60 reqs/hora → BAN depois de 36 segundos

// ✅ Com deduplicação:
export async function getUser(login: string) {
  const cache = createCache();
  return cache.fetch(key, async () => {
    return fetch(`...`).then(r => r.json());
  });
}

// 100 requisições = 1 request à API
```

### Erro 2: TTL muito baixo

```ts
// ❌ Ruim: Cache expira a cada segundo
const cache = createCache({ defaultTTL: 1_000 });  // 1s
// 100 users a cada segundo = 100 requests por segundo
// Rate limit de 60/hora = ~0.016/s = BAN em 6 segundos

// ✅ Correto:
const cache = createCache({ defaultTTL: 30_000 });  // 30s
// 100 users = 100/30 = ~3 requests por segundo
// Rate limit de 60/hora = 0.016/s = SEM PROBLEMA
```

### Erro 3: Não usar SWR

```ts
// ❌ Sem SWR: Quando TTL expira, trava esperando API
const user = await cache.fetch(key, fetchGitHub);  // ~300ms espera

// ✅ Com SWR: Retorna rápido mesmo ao expirar
const user = await cache.fetch(
  key,
  fetchGitHub,
  { stale: true }  // Retorna antigo em 1ms, fetc em background
);
```

## 💡 Boas práticas

### 1. Calcular TTL baseado em rate limit

```ts
// GitHub: 60 reqs por hora  4-5% da hora
// Logo: TTL = 60 segundos da hora / 60 reqs = 1 segundo por request
// Mas com dedup: 20 usuários = 20/20 = 1 usuário por segundo
// TTL = 20-30 segundos é seguro

const cache = createCache({ defaultTTL: 20_000 });
```

### 2. Monitorar deduplicação

```ts
setInterval(() => {
  const stats = devCache.stats();
  const pending = stats.pending;  // Promises aguardando
  
  if (pending > 10) {
    console.log(`🔄 ${pending} dedup requests`);
  }
}, 10_000);
```

### 3. Tag para invalidação em grupo

```ts
return cache.fetch(key, fetch, {
  tags: ["github", "github:user"],
});

// Depois: invalida todos users GitHub
cache.invalidateTag("github:user");
```

### 4. Trate erro com fallback

```ts
async function getUser(login: string) {
  try {
    return await cache.fetch(key, fetchGitHub, { stale: true });
  } catch (err) {
    // Rate limit? Retorna cache antigo
    const stale = cache.get(key);
    if (stale) return stale;
    throw err;  // Sem fallback, re-lança
  }
}
```

## 🔗 Próximos passos

- [Cacheando API Externa](/docs/guides/cacheando-api-externa) - Estratégias completas
- [Performance](/docs/performance-boas-praticas) - TTL recommendations
- [Conceitos: Deduplicação](/docs/conceitos-principais) - How dedup works
