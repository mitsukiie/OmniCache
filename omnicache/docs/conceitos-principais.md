---
sidebar_position: 3
---

# Conceitos Principais 🧠

Aqui explicamos os conceitos fundamentais que tornam OmniCache poderoso. Leia esta página antes de explorar exemplos avançados.

---

## 1. Cache

### 🧠 O que é

Cache é um armazenamento rápido e temporário de dados frequentemente acessados. Em vez de regenerar/recarregar, vocé reutiliza o último resultado.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<number>();
const key = "contador";

// Primeira vez: calcula
await cache.set(key, 100, { ttl: 10_000 });
const val1 = cache.get(key); // 100 (instantaneo)

// Segunda vez: está em cache
const val2 = cache.get(key); // 100 (ainda em cache, nenhuma computação)

// Terceira vez: após 11 segundos
// TTL expirou → cache.get retorna null
const val3 = cache.get(key); // null
```

### 🧩 Uso real

```ts
type CachedConfig = { feature_flags: string[] };
const configCache = new Cache<CachedConfig>();

// Na inicialização da aplicação
const config = await fetch("/api/config").then(r => r.json());
configCache.set("app-config", config, { ttl: 5 * 60_000 }); // 5 minutos

// Em outro lugar, reutilize
const currentConfig = configCache.get("app-config");
if (currentConfig?.feature_flags.includes("dark-mode")) {
  // ... aplique tema escuro
}
```

---

## 2. TTL (Time To Live)

### 🧠 O que é

TTL é o **tempo em milissegundos** que um valor permanece válido no cache. Depois disso, expira e deve ser recalculado.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<string>();

await cache.set("msg", "Olá!", { ttl: 2_000 }); // 2 segundos
console.log(cache.get("msg")); // "Olá!" ✅

await new Promise(r => setTimeout(r, 3_000)); // Espera 3 segundos
console.log(cache.get("msg")); // null (expirou)
```

### 🧩 Uso real

```ts
type ExchangeRate = { usd_to_brl: number };
const ratesCache = new Cache<ExchangeRate>({ defaultTTL: 60_000 }); // 1 minuto

// Taxa de câmbio: 1 minuto de cache é razovável
await ratesCache.fetch("rates", async () => {
  const res = await fetch("https://api.exchangerate.host/latest");
  return res.json() as Promise<ExchangeRate>;
});

// Depois de 1 minuto: próxima chamada refaz o fetch
```

### 💡 Boas práticas de TTL

| Tipo de dado | TTL recomendado | Razão |
|---|---|---|
| Taxa de câmbio | 30-60s | muda constantemente |
| Perfil de usuário | 5-15min | muda ocasionalmente |
| Configurações | 30min+ | raramente muda |
| Cache de bot Discord | 15-30s | muitos hits, dados levés |
| Listagem de produtos | 10min | reposicionamento periódico |

---

## 3. Stale-While-Revalidate (SWR)

### 🧠 O que é

SWR é uma estratégia: se o cache expirou, retorne o valor antigo **imediatamente** e atualize em background.

**Benefício:** usuário vé resposta rápida (ainda que levemente desatualizada) enquanto vocé refaz a busca.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<string>();

// Primeira chamada: calcula
await cache.fetch("news", async () => "Principal: Eleitor corrige", { ttl: 3_000 });
console.log("1:", cache.get("news")); // "Principal: Eleitor corrige"

await new Promise(r => setTimeout(r, 4_000)); // Espera expirar

// Segunda chamada COM SWR: retorna antigo rápidamente
const newsPromise = cache.fetch("news", async () => "Principal: Amazônia em chamas", {
  stale: true,  // ← ATIVA SWR
  ttl: 3_000,
});

console.log("2:", await newsPromise); // "Principal: Eleitor corrige" (antigo, rápido!)
await new Promise(r => setTimeout(r, 500)); // Pequeno delay
console.log("3:", cache.get("news")); // "Principal: Amazônia em chamas" (atualizado em background)
```

### 🧩 Uso real

```ts
type News = { title: string; timestamp: number };
const newsCache = new Cache<News>();

export async function getLatestNews(): Promise<News> {
  return newsCache.fetch(
    "news:latest",
    async () => {
      const res = await fetch("https://api.news.com/latest");
      return res.json() as Promise<News>;
    },
    {
      stale: true,  // Retorna noticia antigo se expirou
      ttl: 30_000,  // Mas atualiza a cada 30s em background
      tags: ["news"],
    }
  );
}

// Uso em dashboard
// const news = await getLatestNews();
// Renderizar(news); // Aparece dentro de 1-5ms (cache) em vez de 200-500ms (API)
```

### ✅ Quando usar SWR

- Dashboard/UI que tolera dados levemente antigos.
- Bot que prioriza resposta rápida sobre exatidão.
- Feeds/feeds que recarregam continuamente.

### 🚫 Quando NÃO usar SWR

- Transações financeiras (precisa ser 100% correto).
- Autenticação (sempre validar contra servidor).
- Dados que NUNCA deveriam estar desatualizados.

---

## 4. Deduplicação de Requests

### 🧠 O que é

Se 10 requisnações chegarem **simultaneamente** para a mesma chave, OmniCache executa apenas 1 função real. As outras 9 reutilizam a mesma promise pendente.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<number>();
let executionCount = 0;

async function expensiveCompute(): Promise<number> {
  executionCount++;
  console.log(`Execução #${executionCount}`);
  await new Promise(r => setTimeout(r, 1000));
  return 42;
}

// Simule 5 chamadas simultâneas
const promises = Array(5)
  .fill(null)
  .map(() => cache.fetch("answer", expensiveCompute));

const results = await Promise.all(promises);
console.log(results);         // [42, 42, 42, 42, 42]
console.log(executionCount);  // 1 (não 5!)
```

**Resultado:** apenas 1 "Execução #1" impresso (não 5).

### 🧩 Uso real

```ts
type User = { id: string; name: string };
const userCache = new Cache<User>();

async function getUser(id: string): Promise<User> {
  return userCache.fetch(`user:${id}`, async () => {
    console.log(`🔡 Chamando API para usuário ${id}...`);
    const res = await fetch(`https://api.example.com/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<User>;
  });
}

// Em um bot Discord: 10 usuários pedem "/profile" do mesmo jogador
const results = await Promise.all([
  getUser("alice"),
  getUser("alice"),
  getUser("alice"),
  // ... 7 vezes mais
]);

// Console mostra: 🔡 Chamando API... (apenas UMA vez!)
// As 9 outras chamadas reutilizam a mesma promise
```

### 💡 Boas práticas

- Deduplicação acontece **automaticamente** para a mesma chave.
- Muito valioso em APIs com múltiplos clients simultâneos.
- Reduz carga no upstream (API/banco) drasticamente.

---

## 5. Tags

### 🧠 O que é

Tags agrupam entradas de cache para invalidação em lote. Útil quando você quer descartar múltiplas chaves relacionadas.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<any>();

// Armazene com tags
await cache.fetch("user:1", loadUser, { tags: ["user", "user:1"] });
await cache.fetch("user:2", loadUser, { tags: ["user", "user:2"] });
await cache.fetch("post:1", loadPost, { tags: ["post", "user:1"] });

console.log(cache.stats().size); // 3

// Invalide por tag
const removed = cache.invalidateTag("user");
console.log(removed);             // 2 (removeu user:1 e user:2)
console.log(cache.stats().size);  // 1 (apenas post:1 permanece)
```

### 🧩 Uso real

```ts
type Post = { id: string; title: string; authorId: string };
const postCache = new Cache<Post>();

async function getPost(postId: string): Promise<Post> {
  const authorId = postId.split(":")[1];
  return postCache.fetch(
    `post:${postId}`,
    async () => fetchPostData(postId),
    {
      tags: [
        "post",
        `author:${authorId}`,  // Tag por autor
        `post:${postId}`,      // Tag específica
      ],
    }
  );
}

// Se um post foi editado:
await updatePost("post:alice:123", { title: "Novo título" });
postCache.invalidateTag("post:alice:123"); // Remove cache daquele post

// Se um autor foi banido, remova todos seus posts:
cache.invalidateTag("author:alice"); // Remove todos os posts dela
```

### 💡 Padrões de tag

```ts
// Bom: hierarárquico e descritivo
awaits cache.fetch(key, fn, { tags: ["post", "author:alice", "post:123"] });

// Ruim: genérico demais
await cache.fetch(key, fn, { tags: ["data", "cache"] });
```

---

## 6. Namespace

### 🧠 O que é

Namespace prefixoa chaves automaticamente sem você ter que montar string toda hora. Útel para multi-tenant ou separação lógica.

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<string>();

// Sem namespace (manual)
await cache.fetch("tenant:a:user:1", () => "Alice");
await cache.fetch("tenant:a:user:2", () => "Bob");
await cache.fetch("tenant:b:user:1", () => "Charlie");

// Com namespace (automatizado)
const tenantA = cache.namespace("tenant:a");
const tenantB = cache.namespace("tenant:b");

await tenantA.fetch("user:1", () => "Alice");    // Chave interna: tenant:a:user:1
await tenantA.fetch("user:2", () => "Bob");      // Chave interna: tenant:a:user:2
await tenantB.fetch("user:1", () => "Charlie");  // Chave interna: tenant:b:user:1
```

### 🧩 Uso real

```ts
type TenantConfig = { theme: string; language: string };
const globalCache = new Cache<TenantConfig>();

function getTenantCache(tenantId: string) {
  return globalCache.namespace(`tenant:${tenantId}`);
}

// Em um middleware/contexto de requisição
export async function getConfig(tenantId: string): Promise<TenantConfig> {
  const cache = getTenantCache(tenantId);
  return cache.fetch(
    "config",  // Será prefixado automaticamente
    async () => {
      const res = await fetch(`https://api.example.com/tenants/${tenantId}/config`);
      return res.json() as Promise<TenantConfig>;
    },
    { ttl: 10 * 60_000 }
  );
}

// Invalidar tudo de um tenant
cache.invalidatePrefix(`tenant:${tenantId}:`);
```

### 💡 Vantagens

- Evita string concatenation repetitiva.
- Nested: `cache.namespace("a").namespace("b")` → chaves "a:b:..."
- Mais legível e menos erro-propenso.

---

## 7. Pending Promises

### 🧠 O que é

Quando você chama `fetch` e a chave não está em cache, OmniCache cria uma "promise pendente" que outras chamadas simultâneas reutilizam (deduplicação).

### ⚡ Exemplo mínimo

```ts
const cache = new Cache<number>();

// Penda 2 chamadas
const p1 = cache.fetch("key", async () => {
  await new Promise(r => setTimeout(r, 1000));
  return 42;
});

const p2 = cache.fetch("key", async () => {
  await new Promise(r => setTimeout(r, 1000));
  return 99; // Nunca será executado!
});

const results = await Promise.all([p1, p2]);
console.log(results);              // [42, 42]
console.log(cache.stats().pending); // 0 (já resolveu)
```

### 💡 Boas práticas

- OmniCache limpa promises pendentes antigas automaticamente (veja `maxPendingAgeMs`).
- Monitore `cache.stats().pending` para detectar travamentos.
- Se `pending` cresce infinitamente → suas funções não estão resolvendo.

---

## Resumo dos Conceitos

| Conceito | O que faz | Quando usar |
|---|---|---|
| **Cache** | Guarda valor temporariamente | Sempre que quer reutilizar dados |
| **TTL** | Define tempo de validade | Sempre, depende do dado |
| **SWR** | Retorna antigo + atualiza background | UX prioritária sobre segurança |
| **Deduplicatio** | Reutiliza promise de chamadas simultâneas | Automático, reduz carga |
| **Tags** | Agrupa para invalidação em lote | Dados relacionados |
| **Namespace** | Prefixoa chaves automaticamente | Multi-tenant, separação lógica |
| **Pending** | Gerencia promises em execução | Deduplica interna, monitore |

> 💡 **Próximo passo:** explore [API Reference](/docs/api/cache) para ver cada método em detalhe.
