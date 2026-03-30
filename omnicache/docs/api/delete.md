---
title: delete
---

# delete

## 🧠 O que é

`delete` remove uma chave específica do cache.

## ❓ Por que existe

Quando você quer remover uma entrada sem afetar outras.

## ✅ Quando usar

- Usuário faz logout: remova seu cache.
- Post é deletado: remova do cache.
- Um valor específico fica inválido.

## 🚫 Quando NÃO usar

- Múltiplas entradas relacionadas: use `invalidateTag` (mais eficiente).
- Prefixo conhecido: use `invalidatePrefix`.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();
cache.set("msg", "Valor", { ttl: 5_000 });

cache.delete("msg");
const result = cache.get("msg");
console.log(result); // null
```

## 🧩 Exemplo real de produção

```ts
type Session = { userId: string; token: string };
const sessionCache = new Cache<Session>();

export function deleteUserSession(userId: string) {
  sessionCache.delete(`session:${userId}`);
  console.log(`Sessão de ${userId} removida`);
}

export async function handleLogout(userId: string) {
  await sendLogoutEvent(userId);
  deleteUserSession(userId); // Remove cache local
}
```

## ⚠️ Erros comuns

### 1. Usar delete em loop sem validar antes

**❌ Errado:**
```ts
for (let i = 0; i < 10_000; i++) {
  cache.delete(`item:${i}`); // Lento se maioria não existe
}
```

**✅ Correto:**
```ts
cache.invalidatePrefix("item:"); // Remove todas de uma vez
```

## 💡 Boas práticas

1. **Use `delete` para removals isoladas:**
```ts
cache.delete(`session:${userId}`);
```

2. **Use `invalidateTag` para grupos:**
```ts
// Não:
cache.delete(`post:1`);
cache.delete(`post:2`);

// Sim:
cache.invalidateTag("post");
```

## Ver também

- [invalidateTag](/docs/api/invalidate-tag) - Remover grupo por tag
- [invalidatePrefix](/docs/api/invalidate-prefix) - Remover por prefixo
