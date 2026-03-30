---
sidebar_position: 2
---

# Quick Start 🚀

## 🧠 O que vamos aprender

Nesta página você vai criar um cache funcional em menos de 5 minutos e entender como funciona a deduplicação de requests.

## O ponto de partida

Você tem uma função que busca dados (API, banco, etc) e quer evitar chamadas repetidas.

## JavaScript

### Instalação

```bash
npm install flowcache
```

### Código mínimo

```js
import { Cache } from "flowcache";

// 1️⃣ Crie uma instância de cache
const cache = new Cache({ defaultTTL: 30_000 }); // TTL = 30 segundos

// 2️⃣ Defina sua função async
async function getUser(id) {
  return cache.fetch(`user:${id}`, async () => {
    console.log(`📡 Buscando usuário ${id}...`);
    const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

// 3️⃣ Use a função normalmente (agora com cache automático)
const user1 = await getUser("1");     // 📡 Buscando usuário 1... (miss)
console.log(user1.name);              // "Leanne Graham"

const user1_again = await getUser("1"); // ✅ Retorna do cache (hit)
console.log(user1_again.name);          // "Leanne Graham"

const user2 = await getUser("2");     // 📡 Buscando usuário 2... (miss)

// 4️⃣ Veja as estatísticas
console.log(cache.stats());
// { hits: 1, misses: 2, staleHits: 0, pending: 0, size: 2 }
```

**O que acontece aqui:**
- `cache.fetch(key, fn)` verifica se `key` existe.
- Se existe e é válido → retorna instantaneamente (hit).
- Se não existe → executa `fn`, guarda resultado, retorna (miss).
- Se expirou → próxima chamada repete o processo.

### Teste em tempo real

Crie `test.js`:

```js
import { Cache } from "flowcache";

const cache = new Cache({ defaultTTL: 5_000 }); // 5 segundos apenas

async function getData() {
  return cache.fetch("test-key", async () => {
    const now = new Date().toLocaleTimeString();
    console.log(`⏱️  Dados buscados às ${now}`);
    await new Promise(r => setTimeout(r, 500)); // simula latência
    return { timestamp: now };
  });
}

// Chamadas rápidas
await getData(); // ⏱️ Dados buscados
await getData(); // ✅ Do cache (nenhum log novo)
await getData(); // ✅ Do cache (nenhum log novo)

// Espera expirar
console.log("Esperando 6 segundos...");
await new Promise(r => setTimeout(r, 6000));

await getData(); // ⏱️ Dados buscados às ... (TTL expirou!)
```

Rodando:
```bash
node test.js
```

## TypeScript

No TypeScript, você define o tipo genérico `Cache<T>` para tipagem forte:

```ts
import { Cache } from "flowcache";

// 1️⃣ Defina o tipo de dado que você vai cachear
type User = {
  id: number;
  name: string;
  email: string;
  username: string;
};

// 2️⃣ Crie cache tipado
const cache = new Cache<User>({
  defaultTTL: 30_000,
});

// 3️⃣ Defina função com tipagem
async function getUser(id: string): Promise<User> {
  return cache.fetch(`user:${id}`, async () => {
    console.log(`📡 Buscando usuário...`);
    const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<User>;
  });
}

// 4️⃣ Use a função (com autocompletar de propriedades User)
const user = await getUser("1");
console.log(user.name);      // TypeScript sabe que 'name' existe ✅
console.log(user.age);        // TypeScript avisa erro ✅

const stats = cache.stats();
console.log(stats.hits);      // TypeScript sabe que hits é number ✅
```

### Diferenças TypeScript

| Característica | JavaScript | TypeScript |
|---|---|---|
| Tipagem | sem segurança | `Cache<User>` garante tipos |
| Autocompletar | genérico | exato para suas propriedades |
| Erros | descobertos em runtime | descobertos durante desenvolvimento |

## ⚡ Deduplicação (o super-poder)

O maior benefício do FlowCache é deduplicar requests simultâneos:

```ts
const cache = new Cache<number>();

async function fetchExpensiveData() {
  return cache.fetch("expensive", async () => {
    console.log("🔥 Calculando...");
    await new Promise(r => setTimeout(r, 1000)); // 1 segundo
    return 42;
  });
}

// Simule 10 requests simultâneos (como em um bot ou API com múltiplos usuários)
const promises = Array(10).fill(null).map(() => fetchExpensiveData());

const results = await Promise.all(promises);
console.log(results);  // [42, 42, 42, 42, 42, 42, 42, 42, 42, 42]
console.log(cache.stats()); // misses: 1, hits: 9 ← IMPORTANTE!
```

**O que aconteceu:**
- 10 chamadas simultâneas para a mesma chave.
- Apenas 1 cálculo real foi executado (veja "🔥 Calculando..." uma vez).
- As outras 9 `awaited` a mesma promise.
- Resultado: 9x mais rápido, 10x menos CPU.

### Sem deduplicação (o problema)

```ts
// Sem cache - cada chamada seu próprio processamento
Promise.all(Array(10).fill(null).map(() => {
  console.log("🔥 Calculando..."); // imprime 10 vezes!
  return new Promise(r => setTimeout(() => r(42), 1000));
}));
```

## 🧩 Exemplo real rápido: Bot Discord

Situação: seu bot Discord responde comandos de perfil.

```ts
import { Cache } from "flowcache";
import { Client, Events, GatewayIntentBits } from "discord.js";

type Profile = { userId: string; level: number; score: number };
const profileCache = new Cache<Profile>({ defaultTTL: 15_000 });

async function getProfile(userId: string): Promise<Profile> {
  return profileCache.fetch(`profile:${userId}`, async () => {
    const data = await fetch(`https://api.game.com/profiles/${userId}`);
    return data.json();
  });
}

const client = new Client({ intents: [GatewayIntentBits.DirectMessages] });

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.commandName === "perfil") {
    const profile = await getProfile(interaction.user.id);
    await interaction.reply(`Seu nível: ${profile.level}`);
    // Se outro usuário pedir perfil do mesmo jogador simultaneamente:
    // → ambos compartilham o cache (deduplicação automática)
  }
});
```

## **🚫 Erros comuns no Quick Start**

### 1. Esquecer chave que descreva os dados

**❌ Errado:**
```ts
await cache.fetch("data", () => getUser(userId));
// Todos os usuários compartilham o mesmo cache!
```

**✅ Correto:**
```ts
await cache.fetch(`user:${userId}`, () => getUser(userId));
// Cada usuário tem sua própria entrada
```

### 2. Tentar compartilhar cache entre processos

**❌ Errado:**
```ts
// Dois processos rodando
// Processo 1: cache.fetch...
// Processo 2: cache.fetch... (não vê o cache do Processo 1)
```

**✅ Correto:**
- Use FlowCache para cache local de cada instância.
- Use Redis se precisar compartilhar entre processos.

### 3. TTL muito alta para dados dinâmicos

**❌ Errado:**
```ts
const cache = new Cache({ defaultTTL: 24 * 60 * 60 * 1000 }); // 1 dia!
await cache.fetch("temperature", getTemperature); // dados desatualizados
```

**✅ Correto:**
```ts
const cache = new Cache({ defaultTTL: 60_000 }); // 1 minuto
await cache.fetch("temperature", getTemperature); // sempre fresco
```

## 💡 Boas práticas para começar

1. **Escolha TTL baseado em frequência de mudança:**
   - Dados que mudam segundos: 3-10 segundos
   - APIs externas: 30-60 segundos
   - Configurações: 5+ minutos

2. **Sempre inclua identificadores únicos na chave:**
   ```ts
   `type:identifier` // ✅ Bom
   `user:123`
   `post:456:comments`
   ```

3. **Teste com múltiplas chamadas simultâneas para validar deduplicação.**

4. **Comece simples, adicione features conforme precisa:**
   - Primeira iteração: apenas `fetch`
   - Depois: `stale`, tags, namespace
   - Depois: hooks, eventos

## 📊 Próximas páginas

- [Conceitos Principais](/docs/conceitos-principais) - entender TTL, SWR, tags
- [API Reference](/docs/api/cache) - todas as funções disponíveis
- [Guias Práticos](/docs/guides/cacheando-api-externa) - casos de uso reais
