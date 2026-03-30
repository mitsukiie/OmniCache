---
title: invalidatePrefix
---

# invalidatePrefix

## 🧠 O que é

`invalidatePrefix` remove **todas** as entradas cuja chave começa com um prefixo específico.

## ❓ Por que existe

Quando seus dados têm estrutura hierárquica de chaves e você quer remover um "ramo" todo.

## ✅ Quando usar

- Logout: `cache.invalidatePrefix("user:123:")`.
- Remover tenant: `cache.invalidatePrefix("tenant:a:")`.
- Limpar namespace: `cache.invalidatePrefix("admin:")`.

## 🚫 Quando NÃO usar

- Entradas não-relacionadas por prefixo: use `invalidateTag`.
- Uma entrada: use `delete`.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<number>();

cache.set("user:1:name", "Alice");
cache.set("user:1:email", "alice@ex.com");
cache.set("user:2:name", "Bob");

const removed = cache.invalidatePrefix("user:1:");
console.log(removed); // 2
console.log(cache.stats().size); // 1
```

## 🧩 Exemplo real de produção

```ts
type UserData = { name: string; email: string; settings: string };
const userCache = new Cache<UserData>();

export async function handleUserLogout(userId: string) {
  // Remove TUDO daquele usuário
  const removed = userCache.invalidatePrefix(`user:${userId}:`);
  console.log(`Logout: removidos ${removed} items do cache`);
}

export async function deleteUser(userId: string) {
  // Remove todos os dados do usuário
  userCache.invalidatePrefix(`user:${userId}:`);
}

export async function removeAllAdminCache() {
  const removed = userCache.invalidatePrefix("admin:");
  console.log(`${removed} entradas admin removidas`);
}
```

## ⚠️ Erros comuns

### 1. Prefixo muito genérico

**❌ Errado:**
```ts
cache.invalidatePrefix("u"); // Remove "u", "user", "user:1", "upload:..."!
```

**✅ Correto:**
```ts
cache.invalidatePrefix("user:"); // Específico
```

### 2. Esquecer o separador

**❌ Errado:**
```ts
cache.invalidatePrefix("user:1"); // Remove "user:1" E "user:10", "user:11"...
```

**✅ Correto:**
```ts
cache.invalidatePrefix("user:1:"); // Remove apenas "user:1:*"
```

## 💡 Boas práticas

1. **Use prefixos consistentes:**
```ts
// Cache:
cache.set("user:123:name", "Alice");
cache.set("user:123:email", "alice@ex.com");

// Logout:
cache.invalidatePrefix("user:123:"); // Todas de uma vez
```

2. **Combine com namespace:**
```ts
const userNS = cache.namespace(`user:${userId}`);
// Depois:
cache.invalidatePrefix(`user:${userId}:`);
```

## Ver também

- [invalidateTag](/docs/api/invalidate-tag) - Remover por tag
- [delete](/docs/api/delete) - Remover uma entrada
