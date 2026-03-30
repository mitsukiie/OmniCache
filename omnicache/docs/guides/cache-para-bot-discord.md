---
title: Cache para Bot Discord
---

# Cache para Bot Discord

## 🧠 O Caso

Bot Discord que reage a comandos (pesquisa usuário, retorna info). Sem cache, cada comando toma 300-500ms. Com cache, retorna em 2-5ms.

## ❓ Por que cache em bot?

- Muitos usuários executam o mesmo comando
- Bot Discord espera responder < 3s antes de timeout
- Evita spam de requisições na API

## ✅ Quando usar

- Comandos que buscam dados em API
- Dados que não mudam constantemente

## 🚫 Quando NÃO usar

- Dados user-specific sem isolamento
- Dados sensíveis (senhas, tokens)

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "omnicache";
import { Client, Events } from "discord.js";

const cache = createCache<any>();
const client = new Client();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "profile") {
    const userId = interaction.options.getString("user");
    
    const profile = await cache.fetch(
      `user:${userId}`,
      async () => {
        const res = await fetch(`https://api.example.com/users/${userId}`);
        return res.json();
      },
      { ttl: 60_000 } // 1 minuto
    );

    await interaction.reply(`Profile: ${profile.name}`);
  }
});
```

## 🧩 Exemplo real de produção

Bot que tem comando `/server-info` com cache de status:

```ts
import { createCache } from "omnicache";
import { Client, Events, SlashCommandBuilder } from "discord.js";

type ServerInfo = {
  name: string;
  players: number;
  maxPlayers: number;
  status: "online" | "offline";
  lastUpdate: Date;
};

const serverCache = createCache<ServerInfo>({
  defaultTTL: 30_000,
  maxEntries: 100,
});

async function getServerInfo(serverId: string): Promise<ServerInfo> {
  return serverCache.fetch(
    `server:${serverId}`,
    async () => {
      const res = await fetch(`https://game-api.example.com/servers/${serverId}`);
      if (!res.ok) throw new Error(`Server API error: ${res.status}`);
      
      const data = await res.json();
      return {
        name: data.name,
        players: data.active_players,
        maxPlayers: data.max_players,
        status: data.is_online ? "online" : "offline",
        lastUpdate: new Date(),
      };
    },
    {
      ttl: 30_000,
      tags: ["game", `game:server:${serverId}`],
    }
  );
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  try {
    if (interaction.commandName === "server-info") {
      await interaction.deferReply(); // Mais de 3s pode precisar
      
      const serverId = interaction.options.getString("server");
      const info = await getServerInfo(serverId);

      const embed = {
        title: info.name,
        fields: [
          { name: "Status", value: info.status, inline: true },
          { name: "Players", value: `${info.players}/${info.maxPlayers}`, inline: true },
          { name: "Last Update", value: info.lastUpdate.toISOString() },
        ],
        color: info.status === "online" ? 0x00ff00 : 0xff0000,
      };

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    await interaction.editReply(`❌ Erro: ${err.message}`);
  }
});

// Invalidar cache quando user atualiza servidor
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "restart-server") {
    const serverId = interaction.options.getString("server");
    
    // Atualiza servidor
    await fetch(`https://game-api.example.com/servers/${serverId}/restart`, {
      method: "POST",
    });

    // Invalida cache (dados mudaram)
    serverCache.delete(`server:${serverId}`);
    
    await interaction.reply("✅ Servidor reiniciado!");
  }
});
```

## ⚡ Cenário de deduplicação

5 usuários executam `/server-info` simultaneamente:

```
t=0:    User1: /server-info → cache.fetch começa
t=10:   User2: /server-info → DEDUP (aguarda User1)
t=20:   User3: /server-info → DEDUP (aguarda User1)
t=30:   User4: /server-info → DEDUP (aguarda User1)
t=40:   User5: /server-info → DEDUP (aguarda User1)
t=300:  API responde
        Todos 5 usuários recebem resposta em ~300ms total
        Apenas 1 requisição foi feita! ✅
        
Sem dedup:
        Cada um faz request (5 requests simultâneas)
        Ainda 300ms, mas API sobrecarregada
```

## ⚠️ Erros comuns

### Erro 1: Cache sem isolamento

```ts
// ❌ PERIGOSO: Dois usuários veem cache um do outro
async function getUserProfile(userId: string) {
  return cache.fetch("user", async () => {
    return await fetch(`/api/users/${userId}`).then(r => r.json());
  });
}

getUserProfile("user123");
getUserProfile("user456");  // Retorna dados de user123! ❌

// ✅ Correto: Chave unique por user
async function getUserProfile(userId: string) {
  return cache.fetch(`user:${userId}`, async () => {
    return await fetch(`/api/users/${userId}`).then(r => r.json());
  });
}
```

### Erro 2: Cache de erro

```ts
// ❌ Ruim: Se API retorna 404, o erro é cacheado
const profile = await cache.fetch(key, async () => {
  const res = await fetch(url);
  return res.json();  // Lança erro se res.status = 404
});

// Em produção, caches o erro por 30s, mesmo que user exista agora

// ✅ Melhor: Só cachear sucesso
async function getUser(userId: string) {
  const res = await fetch(`/api/users/${userId}`);
  if (!res.ok) throw new Error(`User not found`);
  
  const user = await res.json();
  
  cache.set(`user:${userId}`, user, { ttl: 60_000 });
  return user;
}
```

### Erro 3: TTL muito longo

```ts
// ❌ Ruim: User muda nome, cache ainda mostra antigo por 1 hora
cache.fetch(`user:123`, fetch, { ttl: 60 * 60_000 });

// ✅ Melhor:
cache.fetch(`user:123`, fetch, { ttl: 5 * 60_000 }); // 5min

// Ou invalidar ao atualizar:
async function updateUserProfile(userId: string, updates: any) {
  await fetch(`/api/users/${userId}`, { method: "PUT", body: updates });
  cache.delete(`user:${userId}`);  // Invalida
}
```

## 💡 Boas práticas

### 1. Usar comandos `/` com cache

```ts
const command = new SlashCommandBuilder()
  .setName("server-info")
  .setDescription("Mostra status do servidor")
  .addStringOption(option =>
    option
      .setName("server")
      .setDescription("ID do servidor")
      .setRequired(true)
  );

// Discord retorna comando mais rápidamente com cache!
```

### 2. Defer reply se tomar > 3s

```ts
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  // Avise que está processando
  await interaction.deferReply();

  // Agora tem 15 minutos para responder
  const data = await cache.fetch(key, heavyComputation);
  
  await interaction.editReply({ content: "Pronto!" });
});
```

### 3. Tags para invalidação em grupo

```ts
// Cache respostas com tags
await cache.fetch(key, fetch, {
  tags: ["discord", `discord:guild:${guildId}`],
});

// Depois, invalida tudo de um servidor:
cache.invalidateTag(`discord:guild:${guildId}`);
```

### 4. Monitore deduplicação

```ts
setInterval(() => {
  const stats = cache.stats();
  console.log(`
    Cache Stats:
    - Hits: ${stats.hits}
    - Misses: ${stats.misses}
    - Hit Rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)}%
    - Size: ${stats.size}
    - Pending: ${stats.pending}
  `);
}, 60_000);
```

## 🔗 Próximos passos

- [Taxa de Limite](/docs/guides/evitando-rate-limit) - Deduplicação avançada
- [Debug](/docs/guides/debug-e-observabilidade) - Monitorar o bot
- [Performance](/docs/performance-boas-praticas) - Otimização

