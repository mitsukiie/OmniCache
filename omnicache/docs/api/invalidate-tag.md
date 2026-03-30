---
title: invalidateTag
---

# invalidateTag

## 🧠 O que é

`invalidateTag` remove **todas** as entradas associadas a uma tag específica.

## ❓ Por que existe

Quando múltiplos cache são logicamente relacionados, você quer limpá-los em lote sem saber cada chave individual.

## ✅ Quando usar

- Post editado: remova todas as tags daquele post.
- Usuário deletado: remova `tag:user:123`.
- Evento de mudança: invalide grupos por tag.

## 🚫 Quando NÃO usar

- Uma entrada específica: use `delete`.
- Prefixo conhecido: use `invalidatePrefix` (mais eficiente).

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<any>();

cache.set("a", 1, { tags: ["group"] });
cache.set("b", 2, { tags: ["group"] });
cache.set("c", 3, { tags: ["other"] });

const removed = cache.invalidateTag("group");
console.log(removed); // 2
console.log(cache.stats().size); // 1 (apenas "c")
```

## 🧩 Exemplo real de produção

```ts
type Post = { id: string; title: string; createdAt: string };
const postCache = new Cache<Post>();

async function publishPost(post: Post) {
  // Armazena com tags para invalidação depois
  postCache.set(`post:${post.id}`, post, {
    ttl: 10 * 60_000,
    tags: ["post", `author:${post.authorId}`, `published`],
  });
}

async function deletePost(postId:string, authorId: string) {
  postCache.invalidateTag(`post:${postId}`);
  console.log(`Post ${postId} removido do cache`);
}

async function handleAuthorBan(authorId: string) {
  const removed = postCache.invalidateTag(`author:${authorId}`);
  console.log(`Author banido: ${removed} posts removidos do cache`);
}

async function unpublishAllPosts() {
  const removed = postCache.invalidateTag("published");
  console.log(`${removed} posts despublicados do cache`);
}
```

## ⚠️ Erros comuns

### 1. Tags inconsistentes

**❌ Errado:**
```ts
cache.set("key1", data, { tags: ["user"] });
cache.set("key2", data, { tags: ["User"] }); // Maiúscula!
cache.invalidateTag("user"); // Remove apenas key1, não key2!
```

**✅ Correto:**
```ts
// Sempre minúsculas/padrão
cache.set("key1", data, { tags: ["user"] });
cache.set("key2", data, { tags: ["user"] });
cache.invalidateTag("user"); // Remove ambas
```

## 💡 Boas práticas

1. **Use tags hierárquicas:**
```ts
cache.set("data", d, {
  tags: ["post", "post:123", "author:alice"],
});

cache.invalidateTag("post"); // Remove todos os posts
cache.invalidateTag("author:alice"); // Remove todos de Alice
```

2. **Documente tags usadas:**
```ts
// Tags:
// "user" - todas as entradas de usuário
// "user:XXX" - usuário específico
// "session:XXX" - sessão específica
//  "role:admin" - dados de admin
```

## Ver também

- [invalidatePrefix](/docs/api/invalidate-prefix) - Remover por prefixo
- [delete](/docs/api/delete) - Remover uma entrada
