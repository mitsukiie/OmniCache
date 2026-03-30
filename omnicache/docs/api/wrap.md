---
title: wrap
---

# wrap

## 🧠 O que é

`wrap` transforma uma função async em uma versão cacheada, gerando chaves automaticamente baseado em argumentos.

## ❓ Por que existe

Evita boilerplate: em vez de escrever `cache.fetch(chaveManual, fn)` toda vez, `wrap` monta a chave pra você.

## ✅ Quando usar

- Funções que são chamadas frequentemente com argumentos variados.
- APIs ou métodos que naturalmente devem ser cacheados.
- Quando quer encapsular cache na própria função.

## 🚫 Quando NÃO usar

- Para operações simples de cache direto: use `fetch`.
- Quando chave deve ser complexa: `wrap` pode ser insuficiente.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();

const getCached = cache.wrap(
  async (name: string) => `Hello, ${name}!`,
  { key: (name) => `greeting:${name}` }
);

const msg1 = await getCached("Alice"); // miss: executa função
const msg2 = await getCached("Alice"); // hit: do cache
```

## 🧩 Exemplo real de produção

```ts
type Repository = { id: number; name: string; stars: number };
const repoCache = new Cache<Repository>();

const getRepository = repoCache.wrap(
  async (owner: string, repo: string): Promise<Repository> => {
    console.log(`🔍 Buscando ${owner}/${repo} no GitHub...`);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json() as Promise<Repository>;
  },
  {
    // Gera chave baseado em argumentos
    key: (owner, repo) => `github:${owner}:${repo}`,
    
    // TTL padrão
    ttl: 120_000,
    
    // SWR habilitado
    stale: true,
    
    // Tags dinâmicas por owner
    tags: (owner) => ["repo", `owner:${owner}`],
  }
);

// Uso simples
const repo1 = await getRepository("nodejs", "node");
const repo2 = await getRepository("nodejs", "node"); // cache hit
const repo3 = await getRepository("facebook", "react"); // miss: outro owner
```

## ⚠️ Erros comuns

### 1. Gerar chave sem incluir todos os argumentos

**❌ Errado:**
```ts
const fn = cache.wrap(
  async (userId: string, postId: string) => fetch(`/api/users/${userId}/posts/${postId}`),
  { key: (userId) => `post:${userId}` } // Esqueceu postId!
);

const p1 = await fn("alice", "post1"); // Guarda com postId=post1
const p2 = await fn("alice", "post2"); // Retorna post1 (dupliquei!)
```

**✅ Correto:**
```ts
const fn = cache.wrap(fn, {
  key: (userId, postId) => `post:${userId}:${postId}`
});
```

### 2. JSON.stringify com argumentos não-serializáveis

**❌ Errado:**
```ts
const fn = cache.wrap(
  async (obj: CustomObject) => {...}
  // Sem key explícita = usa JSON.stringify(args)
  // Se CustomObject tem métodos: erro
);
```

**✅ Correto:**
```ts
const fn = cache.wrap(fn, {
  key: (obj) => `custom:${obj.id}`
});
```

## 💡 Boas práticas

1. **Sempre defina `key` explicitamente:**
```ts
cache.wrap(fn, {
  key: (...args) => `prefix:${args.join(":")}`,
});
```

2. **Use tags para invalidação segura:**
```ts
cache.wrap(fn, {
  tags: (userId) => ["user", `user:${userId}`],
});

// Depois:
cache.invalidateTag(`user:${userId}`);
```

3. **Combine com `stale: true` para UX:**
```ts
cache.wrap(fn, {
  ttl: 30_000,
  stale: true, // Retorna rápido, atualiza background
});
```

## Ver também

- [fetch](/docs/api/fetch) - Método manual equivalente
- [namespace](/docs/api/namespace) - Para prefixos automáticos
