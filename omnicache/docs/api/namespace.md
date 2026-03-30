---
title: namespace
---

# namespace

## 🧠 O que é

`namespace` cria um escopo de chaves com prefixo automático, sem montar string manualmente.

## ❓ Por que existe

Em aplicações multi-tenant ou com dados hierárquicos, você não quer ficar concatenando `tenant:a:user:1` toda hora. `namespace` faz isso pra você.

## ✅ Quando usar

- Multi-tenant SaaS (cada tenant seu próprio cache).
- Hierarquia lógica de dados (entity > subentity).
- Evitar duplicação de prefixo em múltiplos métodos.

## 🚫 Quando NÃO usar

- Cache simples e flat: usar chaves diretas é mais claro.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<number>();
const ns = cache.namespace("prefix");

await ns.set("key", 42);
const val = ns.get("key"); // chave interna: prefix:key
console.log(val); // 42
```

## 🧩 Exemplo real de produção

```ts
type TenantBilling = { invoices: number; balance: number };
const globalCache = new Cache<TenantBilling>();

function getTenantCache(tenantId: string) {
  return globalCache.namespace(`tenant:${tenantId}`);
}

export async function getBillingInfo(tenantId: string): Promise<TenantBilling> {
  const tenantCache = getTenantCache(tenantId);
  
  return tenantCache.fetch(
    "billing", // Chave interna: tenant:XXX:billing
    async () => {
      const res = await fetch(`https://api.example.com/tenants/${tenantId}/billing`);
      return res.json() as Promise<TenantBilling>;
    },
    { ttl: 5 * 60_000, tags: ["billing"] }
  );
}

export function invalidateTenantCache(tenantId: string) {
  globalCache.invalidatePrefix(`tenant:${tenantId}:`);
}
```

## ⚠️ Erros comuns

### 1. Misturar namespace com chave manual que já tem prefixo

**❌ Errado:**
```ts
const ns = cache.namespace("tenant:a");
await ns.fetch("tenant:a:user:1", fn); // Chave interna: tenant:a:tenant:a:user:1!
```

**✅ Correto:**
```ts
const ns = cache.namespace("tenant:a");
await ns.fetch("user:1", fn); // Chave interna: tenant:a:user:1
```

## 💡 Boas práticas

1. **Use namespace para multi-tenant:**
```ts
function getTenantNS(id: string) {
  return cache.namespace(`t:${id}`);
}

const alice = getTenantNS("alice");
const bob = getTenantNS("bob");
await alice.fetch("data", fn); // t:alice:data
await bob.fetch("data", fn);   // t:bob:data
```

2. **Nested namespaces para hierarquias:**
```ts
const tenant = cache.namespace("tenant:acme");
const users = tenant.namespace("users");
await users.fetch("123", getUserData); // tenant:acme:users:123
```

## Ver também

- [fetch](/docs/api/fetch) - Buscar com cache
- [invalidatePrefix](/docs/api/invalidate-prefix) - Remover por prefixo
