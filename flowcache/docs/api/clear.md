---
title: clear
---

# clear

## 🧠 O que é

`clear` limpa **absolutamente TUDO** do cache: entradas, tags, promises pendentes.

## ❓ Por que existe

Quando você precisa "resetar" a instância completamente.

## ✅ Quando usar

- Logout do usuário (remove todos os dados dele).
- Testes (limpar estado entre testes).
- Shutdown da aplicação (cleanup).
- Debug de problemas de cache.

## 🚫 Quando NÃO usar

- Para remover um grupo específico: use `invalidateTag`.
- Para remover um prefixo: use `invalidatePrefix`.
- Em produção sem estar 100% seguro do impacto.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<number>();
cache.set("a", 1);
cache.set("b", 2);
cache.set("c", 3);

console.log(cache.stats().size); // 3
cache.clear();
console.log(cache.stats().size); // 0
```

## 🧩 Exemplo real de produção

```ts
type UserData = { id: string; name: string };
const userCache = new Cache<UserData>();

export async function handleUserLogout(userId: string) {
  // Opção 1: Remover apenas dados deste usuário
  userCache.invalidatePrefix(`user:${userId}:`);
  
  // Opção 2: Limpar TUDO (apenas em casos extremos)
  // userCache.clear();
}

// Em shutdown
export function gracefulShutdown() {
  userCache.clear();
  userCache.dispose(); // Para timer de sweep
  console.log("Cache limpo e finalizado");
}
```

## ⚠️ Erros comuns

### 1. Usar `clear` em cache compartilhada

**❌ Errado:**
```ts
// Em middleware
if (someCondition) {
  cache.clear(); // Remove cache de TODOS os usuários!
}
```

**✅ Correto:**
```ts
if (someCondition) {
  cache.invalidateTag(`user:${currentUserId}`);
}
```

### 2. Chamar `clear` sem chamar `dispose`

**❌ Errado:**
```ts
const cache = new Cache({ sweepIntervalMs: 10_000 });
// ... usar
cache.clear();
// Timer ainda rodando!
```

**✅ Correto:**
```ts
cache.clear();
cache.dispose(); // Para o timer
```

## 💡 Boas práticas

1. **Prefira `invalidateTag` ou `invalidatePrefix`:**
```ts
// Ao invés de:
cache.clear(); // Radical demais

// Faça:
cache.invalidateTag("user:123"); // Cirúrgico
```

## Ver também

- [invalidateTag](/docs/api/invalidate-tag) - Remover grupo
- [invalidatePrefix](/docs/api/invalidate-prefix) - Remover prefixo
