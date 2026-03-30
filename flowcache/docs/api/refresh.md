---
title: refresh
---

# refresh

## 🧠 O que é

`refresh` força a reexecução da função async e atualiza o valor cacheado, ignorando o cache existente.

## ❓ Por que existe

Quando você precisa de valor **absolutamente fresco**, não importa se já existe em cache.

## ✅ Quando usar

- Usuário clica "atualizar" manualmente.
- Detecção de mudança: dados devem ser atualizados agora.
- Sincronização com fonte externa.
- Testes (garantir dados frescos).

## 🚫 Quando NÃO usar

- Para operação normal: use `fetch` (já faz refetch se expirou).
- Se pode aceitar dados levemente antigos: use `fetch` com `stale: true`.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();

const v1 = await cache.refresh("key", async () => "valor novo");
console.log(v1); // "valor novo"

const v2 = cache.get("key"); // Agora em cache
console.log(v2); // "valor novo"
```

## 🧩 Exemplo real de produção

```ts
type ExchangeRate = { usd_to_brl: number; timestamp: number };
const ratesCache = new Cache<ExchangeRate>({ defaultTTL: 60_000 });

export async function getExchangeRate(): Promise<ExchangeRate> {
  return ratesCache.fetch(
    "rates:usd-brl",
    async () => {
      const res = await fetch("https://api.exchangerate.host/latest?base=USD");
      return res.json() as Promise<ExchangeRate>;
    }
  );
}

// Quando usuário quer taxa fresca
export async function refreshExchangeRate(): Promise<ExchangeRate> {
  return ratesCache.refresh(
    "rates:usd-brl",
    async () => {
      console.log("🔄 Atualizando taxa de câmbio...");
      const res = await fetch("https://api.exchangerate.host/latest?base=USD");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ExchangeRate>;
    },
    { ttl: 60_000, tags: ["rates"] }
  );
}
```

## ⚠️ Erros comuns

### 1. Usar `refresh` em loop sem controle

**❌ Errado:**
```ts
setInterval(() => {
  cache.refresh("data", loadData); // A cada 1 segundo!
  // Se loadData demora 500ms: vai gerar carga excessiva
}, 1_000);
```

**✅ Correto:**
```ts
setInterval(() => {
  cache.refresh("data", loadData);
}, 60_000); // Apenas a cada 1 minuto
```

### 2. Não tratar erros de `refresh`

**❌ Errado:**
```ts
await cache.refresh("data", loadData); // Se loadData falhar?
```

**✅ Correto:**
```ts
try {
  await cache.refresh("data", loadData);
} catch (error) {
  console.error("Refresh falhou", error);
}
```

## 💡 Boas práticas

1. **Combine `refresh` com `tags` para invalidação:**
```ts
await cache.refresh("data", fn, {
  ttl: 30_000,
  tags: ["data", "user:123"],
});

cache.invalidateTag("data"); // Força refresh em breve
```

2. **Use em handlers de "reload" do usuário:**
```ts
export async function handleRefreshButton(userId: string) {
  const freshData = await cache.refresh(
    `dashboard:${userId}`,
    () => loadDashboard(userId)
  );
  return freshData;
}
```

## Ver também

- [fetch](/docs/api/fetch) - Busca com cache automático
- [set](/docs/api/set) - Armazenar manualmente
