---
sidebar_position: 1
---

# OmniCache

## 🧠 O que é

OmniCache é uma biblioteca de **cache em memória para Node.js** que armazena valores por chave com tempo de expiração automático. Funciona localmente no seu processo Node.js, sem dependências externas, e oferece recursos avançados como deduplicação de requisições simultâneas e "stale-while-revalidate".

**Analogia simples:** é como ter um anotador que guarda o resultado da última pergunta e responde imediatamente se alguém fizer a mesma pergunta novamente (enquanto o resultado ainda é válido).

## ❓ Por que existe

Programas Node.js frequentemente consultam as mesmas informações repetidamente:
- Um endpoint de API é chamado 50 vezes em paralelo → você faz 50 requests.
- Um bot Discord responde sempre com os mesmos dados → overhead desnecessário.
- Um dashboard recarrega a página → a mesma query no banco roda 3x.

OmniCache evita isso:
1. **Elimina regeneração desnecessária:** guarda resultado para poupar processamento.
2. **Deduplica requests concorrentes:** 50 chamadas simultâneas = 1 request real.
3. **Melhora latência:** retorna do memória em microsegundos (vs ms/s da rede).
4. **Oferece controle granular:** você decide quando espiar dados frescos ou "antigos mas rápidos".

## ✅ Quando usar

**Use OmniCache quando:**
- Você chama uma API/banco de dados múltiplas vezes com os mesmos parâmetros.
- Seus dados mudam lentamente (segundos~minutos).
- Latência importa (cada ms conta para UX).
- Você quer evitar sobrecarga no upstream (API/banco).
- Trabalha com um único processo Node.js ou precisa de cache local por instância.

**Casos de uso reais:**
- Bots (Discord, Telegram): usuários pedem dados iguais ao mesmo tempo → uma chamada supre todos.
- Dashboards: página recarrega mas dados de ontem ainda servem temporariamente.
- APIs internas: múltiplos microserviços consultam a mesma coisa.
- Workers/Jobs: processam filas repetidamente com dados estáticos.

## 🚫 Quando NÃO usar

**NÃO use OmniCache quando:**
- Você precisa compartilhar cache entre **múltiplos processos/servidores** (use Redis, Memcached).
- Os dados precisam **sobreviver a restart** do processo (use banco de dados).
- Você exige **consistência forte** entre instâncias (Redis com replicação seria solução).
- Os dados mudam a **cada microsegundo** (cache não ajuda se TTL precisa ser 0ms).

**Padrão híbrido comum:**
```
Seu código
     ↓
[OmniCache L1 - memória local, rápido]
     ↓
[Redis/Memcached L2 - compartilhado, persistência]
     ↓
[API/Banco L3 - fonte real]
```

## ⚡ Exemplo mínimo funcional

O menor código que demonstra cache funcionando:

```js
import { Cache } from "omnicache";

const cache = new Cache({ defaultTTL: 10_000 }); // TTL = 10 segundos

async function getData() {
  return cache.fetch("minha-chave", async () => {
    console.log("❌ Executando operação lenta...");
    await new Promise(r => setTimeout(r, 1000)); // simula atraso
    return { resultado: "pronto" };
  });
}

await getData(); // ❌ Executando operação lenta... → {resultado: "pronto"}
await getData(); // ✅ (retorna do cache instantaneamente) → {resultado: "pronto"}
await getData(); // ✅ (retorna do cache instantaneamente) → {resultado: "pronto"}

console.log(cache.stats()); // {hits: 2, misses: 1, ...}
```

**O que acontece:**
1. Primeira chamada: cache vazio → executa função → guarda resultado.
2. Próximas chamadas (dentro de 10s): retorna resultado guardado sem executar função novamente.
3. Depois de 10s: TTL expira → próxima chamada reexecuta função.

## 🧩 Exemplo real de produção

Situação: você tem um bot Discord que retorna informações de perfil de jogador.

```ts
import { Cache } from "omnicache";

type PlayerProfile = {
  id: string;
  name: string;
  level: number;
  score: number;
};

const profileCache = new Cache<PlayerProfile>({
  defaultTTL: 30_000, // 30 segundos
  maxEntries: 1000,   // máximo 1000 perfis em memória
  sweepIntervalMs: 60_000, // limpar expirados a cada 60s
  hooks: {
    onHit: (key) => console.log(`Cache hit: ${key}`),
    onMiss: (key) => console.log(`Cache miss: ${key} - buscando do servidor`),
  },
});

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile> {
  return profileCache.fetch(
    `player:${playerId}`,
    async () => {
      // Apenas esta função é chamada se não estiver em cache
      const response = await fetch(`https://api.game.com/players/${playerId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<PlayerProfile>;
    },
    {
      stale: true,                      // Se expirar, retorna antigo e atualiza em paralelo
      tags: ["player-profile", `player:${playerId}`],
    }
  );
}

// Uso em bot Discord:
// bot.on('interactionCreate', async (i) => {
//   const profile = await getPlayerProfile(i.user.id);
//   await i.reply(`Seu nível: ${profile.level}`);
// });
```

**Ganhos concretos:**
- 10 usuários pedem perfil ao mesmo tempo → 1 chamada API real (deduplica).
- O perfil já existe mas expirou → retorna versão antiga (1ms) enquanto busca novo em background.
- Servidor de API recebe 90% menos requisições.
- Usuários veem resposta em `<5ms` vs `200ms+` de rede.

## ⚠️ Erros comuns

### 1. Esquecer de incluir dados na chave

**❌ Errado:**
```ts
await cache.fetch("user", async () => fetchUser(id)); // Chave ignora id!
// Dois usuários diferentes recebem o mesmo cache
const user1 = await cache.fetch("user", () => fetchUser("alice")); // cache miss
const user2 = await cache.fetch("user", () => fetchUser("bob"));   // cache HIT (retorna alice!)
```

**✅ Correto:**
```ts
await cache.fetch(`user:${id}`, async () => fetchUser(id)); // Chave inclui id
```

### 2. TTL muito alto para dados dinâmicos

**❌ Errado:**
```ts
const cache = new Cache({ defaultTTL: 60 * 60 * 1000 }); // 1 hora
await cache.fetch("exchange-rate", async () => getExchangeRate());
// Taxa de câmbio é velha por até 1 hora → números errados em transações
```

**✅ Correto:**
```ts
const cache = new Cache({ defaultTTL: 60_000 }); // 1 minuto
await cache.fetch("exchange-rate", async () => getExchangeRate());
```

### 3. Não limpar cache quando dados mudam

**❌ Errado:**
```ts
await updateUserName(userId, "novo-nome");
// Cache ainda retorna nome antigo por 30 segundos
```

**✅ Correto:**
```ts
await updateUserName(userId, "novo-nome");
cache.delete(`user:${userId}`); // Para apagar uma chave específica
// OU
cache.invalidateTag(`user:${userId}`); // Para apagar por tag
```

## 💡 Boas práticas

1. **Padronize sua nomenclatura de chaves** → facilitará Debug depois.
   ```ts
   // Bom: prefixo:entidade:id
   `user:${userId}`, `post:${postId}:comments`, `config:feature-flags`
   ```

2. **Use tags para invalidação em lote.**
   ```ts
   await cache.fetch(`user:123`, loadUser, { tags: ["user", "tenant:abc"] });
   // Depois, ao deletar tenant:
   cache.invalidateTag("tenant:abc"); // Remove todos de uma vez
   ```

3. **Combine `stale: true` com TTLs realistas.**
   ```ts
   // Retorna dado antigo IMEDIATAMENTE enquanto busca novo em background
   await cache.fetch(key, fn, { stale: true, ttl: 10_000 });
   ```

4. **Monitore stats em produção.**
   ```ts
   setInterval(() => {
     console.log(cache.stats()); // hit%, miss%, pending promises
   }, 60_000);
   ```

5. **Configure `maxEntries` conforme sua memória disponível.**
   ```ts
   const cache = new Cache({ maxEntries: 5000 }); // Remove entradas antigas se exceder
   ```

## 📦 Instalação

```bash
npm install omnicache
```

## 🔧 Requisitos

- **Node.js 20+**
- Suporta **ESM** e **CommonJS**
- Sem dependências externas
