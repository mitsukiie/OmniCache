---
title: get
---

# get

## 🧠 O que é

`get` retorna um valor armazenado do cache, ou `null` se não existir ou tiver expirado.

## ❓ Por que existe

Quando você precisa ler cache **sem** tentar refetch/recomputa se não existir.

## ✅ Quando usar

- Verificar se um valor está em cache sem carregá-lo.
- Lógica condicional baseada em presença de cache.
- Leitura rápida sem side effects.

## 🚫 Quando NÃO usar

- A maioria dos casos: use `fetch` (mais inteligente).
- Quando precisa garantir valor fresco: use `fetch`.

## ⚡ Exemplo mínimo funcional

```ts
const cache = new Cache<string>();
cache.set("msg", "Oi", { ttl: 5_000 });

const msg = cache.get("msg");
console.log(msg); // "Oi"

const missing = cache.get("inexistente");
console.log(missing); // null
```

## 🧩 Exemplo real de produção

```ts
type UserSettings = { theme: "light" | "dark"; language: string };
const settingsCache = new Cache<UserSettings>();

// Renderizar UI
function renderUserUI(userId: string) {
  const settings = settingsCache.get(`user:${userId}:settings`);
  
  if (settings) {
    // Usar configuração em cache
    applyTheme(settings.theme);
    setLanguage(settings.language);
  } else {
    // Usar padrão
    applyTheme("light");
    setLanguage("en");
  }
}
```

## ⚠️ Erros comuns

### 1. Não tratar `null`

**❌ Errado:**
```ts
const data = cache.get("key");
data.itemId++; // TypeError: Cannot read property 'itemId' of null
```

**✅ Correto:**
```ts
const data = cache.get("key");
if (data) {
  data.itemId++;
}
```

## 💡 Boas práticas

1. **Sempre trate o retorno `null`:**
```ts
const cached = cache.get(`user:${id}`);
if (cached) {
  // Use valor
}
```

2. **Use `get` para lógica condicional simples:**
```ts
const inCache = cache.get("key") !== null;
if (inCache) {
  // Já foi carregado
}
```

## Ver também

- [set](/docs/api/set) - Armazenar valor
- [fetch](/docs/api/fetch) - Buscar ou carregar
