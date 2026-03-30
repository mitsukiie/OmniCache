---
title: JavaScript vs TypeScript
---

# JavaScript vs TypeScript

## 🧠 Diferenças na prática

Ambas as linguagens funcionam com FlowCache, mas TypeScript oferece segurança de tipos que detecta bugs mais cedo.

## JavaScript - Mais rápido de começar

```js
import { Cache } from "flowcache";

const cache = new Cache({ defaultTTL: 30_000 });

async function getUser(userId) {
  return cache.fetch(`user:${userId}`, async () => {
    const res = await fetch(`https://api.example.com/users/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

// Uso
const user = await getUser("123");
console.log(user.name); // Se user não tem 'name', será undefined
```

### Quando coisas dão errado

```js
// Sem TypeScript, bugs aparecem em runtime
const user = await getUser("123");
console.log(user.age);  // undefined (typo: deveria ser 'email'?)

// Sem error: deveria ter aviso durante desenvolvimento!
```

## TypeScript - Mais seguro em produção

```ts
import { Cache } from "flowcache";

// Defina o tipo esperado
type User = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

const cache = new Cache<User>({ defaultTTL: 30_000 });

async function getUser(userId: string): Promise<User> {
  return cache.fetch(`user:${userId}`, async () => {
    const res = await fetch(`https://api.example.com/users/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<User>;
  });
}

// Uso
const user = await getUser("123");
console.log(user.name); // ✅ TypeScript sabe que 'name' existe

// Erro durante desenvolvimento:
console.log(user.age); // ❌ TypeScript: Property 'age' does not exist
```

## 📊 Comparação lado-a-lado

| Aspecto | JavaScript | TypeScript |
|---|---|---|
| Sintaxe | Simples | Mais verboso |
| Tipagem | Runtime apenas | Compile-time |
| Detecta bugs | Tarde (production) | Cedo (desenvolvimento) |
| Curva de aprendizado | Baixa | Média |
| Refatoração | Risco alto | Risco baixo |
| Autocompletar | Genérico | Específico |
| Ideal para | Prototipagem, scripts | Produção, equipes |

## ⚡ Exemplo real: Bug que o TypeScript evita

### ❌ JavaScript

```js
const cache = new Cache();

cache.set("user:1", { id: "1", name: "Alice" });
const user = cache.get("user:1");

// Typo: 'naame' em vez de 'name'
if (user.naame === "Alice") {
  console.log("Match!");  // Nunca executa
}

// Sem erro! Bug silencioso descoberto depois em produção.
```

### ✅ TypeScript

```ts
type User = { id: string; name: string };
const cache = new Cache<User>();

cache.set("user:1", { id: "1", name: "Alice" });
const user = cache.get("user:1");

if (user?.naame === "Alice") {  // ❌ Erro imediatamente!
  // Property 'naame' does not exist on type 'User'
}
```

## 🎯 Recomendações

| Cenário | Recomendação |
|---|---|
| Protótipo/mvp | JavaScript |
| Aplicação solo | JavaScript (opcional) |
| Equipe | TypeScript |
| Produção | TypeScript |
| Biblioteca reutilizável | TypeScript |

## 💡 Abordagem híbrida

Se sua app é em JavaScript, pode usar TypeScript apenas com FlowCache:

```js
// seu-cache.ts (TypeScript)
import { Cache } from "flowcache";

type User = { id: string; name: string };
export const userCache = new Cache<User>({ defaultTTL: 30_000 });

export async function getUser(id: string): Promise<User> {
  return userCache.fetch(`user:${id}`, async () => {
    const res = await fetch(`/api/users/${id}`);
    return res.json() as Promise<User>;
  });
}

// seu-app.js (JavaScript puro)
import { getUser } from "./seu-cache.ts";

async function main() {
  const user = await getUser("123");
  console.log(user.name);
}
```

TypeScript permite gradualmente introduzir tipagem onde importa mais!

## Configurar TypeScript em um projeto JavaScript

```bash
npm install -D typescript
npx tsc --init

# Ou use em arquivo individual:
# seu-arquivo.ts (em vez de .js)
```

Depois compile com:
```bash
npx tsc seu-arquivo.ts
```

## Ver também

- [Quick Start](/docs/quick-start) - Exemplos em JavaScript e TypeScript
- [API Reference](/docs/api/cache) - Toda a tipagem disponível
