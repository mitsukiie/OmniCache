---
title: Cacheando API Externa
---

# Cacheando API Externa

## 🧠 O Caso

Sua app conversa com uma API externa lenta (GitHub, Twitter, etc). Sem cache, cada requisição toma 200-500ms. Com FlowCache, reduz para 1-2ms após primeira chamada.

## ❓ Por que não deixa direto?

- API externa = latência na rede
- Taxa de limite (rate limit) na API
- A API pode cair, cache oferece fallback
- Custo por requisição (alguns serviços cobram)

## ✅ Quando usar

- API de terceiros (GitHub, Weather, etc)
- Dados que não mudam todo segundo
- Você controla o TTL

## 🚫 Quando NÃO usar

- Dados sensíveis que PRECISAM ser 100% fresh
- API que mudas a cada segundo
- User-specific data sem invalidação ao editar

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "flowcache";

const apiCache = createCache<any>();

async function fetchGitHubRepo(owner: string, repo: string) {
  return apiCache.fetch(
    `github:${owner}/${repo}`,
    async () => {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      const res = await fetch(url);
      return res.json();
    },
    { ttl: 60_000 } // 1 minuto
  );
}

// Uso
const repo = await fetchGitHubRepo("microsoft", "vscode");
console.log(repo.stars);
```

## 🧩 Exemplo real de produção

Dashboard que mostra último commit do GitHub de 10 repositórios diferentes:

```ts
import { createCache } from "flowcache";

type GithubRepo = {
  full_name: string;
  stargazers_count: number;
  last_commit_date: string;
};

const githubCache = createCache<GithubRepo>({
  defaultTTL: 5 * 60_000, // 5 minutos
  maxEntries: 100,
});

async function getGithubRepo(owner: string, repo: string): Promise<GithubRepo> {
  return githubCache.fetch(
    `repo:${owner}/${repo}`,
    async () => {
      const headers = {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      };

      const [repoRes, commitsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers }),
      ]);

      const repo = await repoRes.json();
      const commits = await commitsRes.json();

      return {
        full_name: repo.full_name,
        stargazers_count: repo.stargazers_count,
        last_commit_date: commits[0]?.commit.author.date || "unknown",
      };
    },
    { 
      ttl: 5 * 60_000,
      tags: ["github", `repo:${owner}`],
    }
  );
}

// Dashboard component
export async function renderDashboard() {
  const repos = [
    ["microsoft", "vscode"],
    ["torvalds", "linux"],
    ["facebook", "react"],
  ];

  const allRepos = await Promise.all(
    repos.map(([owner, repo]) => getGithubRepo(owner, repo))
  );

  return {
    repos: allRepos,
    updatedAt: new Date(),
    cacheStats: githubCache.stats(),
  };
}

// API endpoint
app.get("/api/dashboard", async (req, res) => {
  const dashboard = await renderDashboard();
  res.json(dashboard);
});
```

### Deduplicação em ação

Se 10 usuários acessarem dashboard simultaneamente:
- Primeiro usuário: 1 requisição GitHub (300ms)
- 9 outros usuários: **compartilham a mesma requisição** (dedup)
- Todos recebem resultado em ~300ms totalizado

Sem cache:
```
t=0:    User1 faz request
t=100:  User2 faz request (aguarda User1)
t=200:  User3 faz request (aguarda User1)
t=300:  Todos recebem github response de User1
        Mas 9 requests foram feitas! ❌
```

Com FlowCache:
```
t=0:    User1 faz request → cache.fetch começa
t=10:   User2 faz request → dedup (aguarda User1)
t=20:   User3 faz request → dedup (aguarda User1)
t=300:  GitHub responde
        Todos recebem uma resposta compartilhada
        Apenas 1 requisição GitHub! ✅
```

## ⚠️ Erros comuns

### Erro 1: Não tratar erros na API

```ts
// ❌ Errado: se API falha, erro não é cacheado
return githubCache.fetch(`repo:${owner}/${repo}`, async () => {
  const res = await fetch(url);
  return res.json();  // Se res.status != 200, vai quebrar
});

// ✅ Correto:
return githubCache.fetch(`repo:${owner}/${repo}`, async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  return res.json();
});
```

### Erro 2: TTL muito baixo

```ts
// ❌ Ruim: Refazer request a cada segundo
const repo = await githubCache.fetch(key, fetchGithub, { ttl: 1_000 });

// ✅ Melhor: Deixar por alguns minutos
const repo = await githubCache.fetch(key, fetchGithub, { ttl: 5 * 60_000 });
```

### Erro 3: Sem invalidação quando atualiza

```ts
// ❌ Ruim: User edita repositório na UI, cache continua antigo
async function updateRepoDescription(owner: string, repo: string, desc: string) {
  await fetch(`/api/repos/${owner}/${repo}`, { method: "PUT", body: desc });
  // Cache não foi invalidado!
}

// ✅ Correto:
async function updateRepoDescription(owner: string, repo: string, desc: string) {
  await fetch(`/api/repos/${owner}/${repo}`, { method: "PUT", body: desc });
  
  // Invalida cache
  githubCache.delete(`repo:${owner}/${repo}`);
  
  // Ou refaça:
  return githubCache.refresh(`repo:${owner}/${repo}`, fetchGithub);
}
```

## 💡 Boas práticas

### 1. Tag por tipo de recurso

```ts
return githubCache.fetch(key, fetch, {
  tags: [
    "github",
    `github:repo`,
    `github:user:${owner}`,
  ],
});

// Depois, invalida todos repos de um user:
githubCache.invalidateTag(`github:user:${owner}`);
```

### 2. Fallback para erro

```ts
export async function getRepo(owner: string, repo: string) {
  try {
    return await githubCache.fetch(key, fetchGithub, { ttl: 5 * 60_000 });
  } catch (err) {
    // API falhou, retorna versão melhorada (stale)
    const cached = githubCache.get(key);
    if (cached) {
      console.warn(`GitHub offline, retornando cache de ${new Date().toISOString()}`);
      return cached;
    }
    throw err;
  }
}
```

### 3. SWR para melhor UX

```ts
// Retorna cache antigo + refaça em background
return githubCache.fetch(
  `repo:${owner}/${repo}`,
  fetchGithub,
  {
    ttl: 5 * 60_000,
    stale: true,  // 👈 SWR sempre que possível
  }
);

// User vê dados em 1ms, recebe atualização em segundo plano
```

### 4. Monitorar rate limit

```ts
export function getGithubHeaders() {
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
  };
  return headers;
}

export async function checkRateLimit() {
  const res = await fetch("https://api.github.com/rate_limit", {
    headers: getGithubHeaders(),
  });
  return res.json();
}

// Periodicamente:
setInterval(async () => {
  const limit = await checkRateLimit();
  const remaining = limit.resources.core.remaining;
  const resetAt = new Date(limit.resources.core.reset * 1000);
  
  if (remaining < 100) {
    console.warn(`⚠️  Rate limit baixo: ${remaining} requisições até ${resetAt}`);
  }
}, 10 * 60_000);
```

## 🔗 Próximos passos

- [Evitando Rate Limit](/docs/guides/evitando-rate-limit) - Estratégias de deduplica
ção
- [Performance](/docs/performance-boas-praticas) - TTL recommendations
- [API: invalidateTag](/docs/api/invalidate-tag) - Invalidação baseada em tags
