---
title: Cache por Usuário
---

# Cache por Usuário

## 🧠 O Conceito

Quando app é multi-user, cada usuário tem seus próprios dados. Sem isolamento, User A vê dados do User B! A solução é incluir `userId` na chave do cache.

## ❓ Por que existe

- Dados são pessoais (settings, preferências, histórico)
- Dois usuários não podem compartilhar cache
- Sem chave unica, User B recebe dados do User A

## ✅ Quando usar

- Preferências de usuário
- Perfil/dados pessoais
- Histórico ou lista do usuário
- Qualquer dado que mude por user

## 🚫 Quando NÃO usar

- Dados públicos (lista de artigos, categorias)
- Dados that não variam por user
- Dados em tempo real que precisam estar 100% fresh

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "flowcache";

type UserSettings = { theme: "light" | "dark"; language: string };

const cache = createCache<UserSettings>({ defaultTTL: 60_000 });

async function getUserSettings(userId: string): Promise<UserSettings> {
  return cache.fetch(
    `user:${userId}:settings`,  // 👈 userId na chave!
    async () => {
      const res = await fetch(`/api/users/${userId}/settings`);
      return res.json();
    }
  );
}

// Uso
const userASettings = await getUserSettings("user_123");  // Seu cache
const userBSettings = await getUserSettings("user_456");  // Outro cache

// Garantido: userBSettings não contamina userASettings
```

## 🧩 Exemplo real de produção

Dashboard que carrega preferências, último projeto aberto, e notifications do user:

```ts
import { createCache } from "flowcache";

type UserProfile = {
  userId: string;
  displayName: string;
  theme: "light" | "dark";
  language: string;
  timezone: string;
  lastProjectId?: string;
  unreadNotifications: number;
};

const userCache = createCache<UserProfile>({
  defaultTTL: 5 * 60_000,  // 5 minutos (pode estar um pouco antigo)
  maxEntries: 10_000,      // até 10k users em cache
});

async function getUserProfile(userId: string): Promise<UserProfile> {
  return userCache.fetch(
    `user:${userId}:profile`,
    async () => {
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<UserProfile>;
    },
    {
      ttl: 5 * 60_000,
      tags: ["user", `user:${userId}`],  // Para invalidação
    }
  );
}

// Invalidar quando user atualiza perfil
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  // 1. Atualiza servidor
  const res = await fetch(`/api/users/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(updates),
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const updated = await res.json();

  // 2. Invalida cache do user (dados mudaram)
  userCache.invalidateTag(`user:${userId}`);

  // 3. Retorna dados frescos
  return updated;
}

// Invalidar tudo de um user quando logout
export function logoutUser(userId: string) {
  userCache.invalidateTag(`user:${userId}`);
  // Todas as chaves com esse user são removidas
}

// API endpoint
app.get("/api/dashboard/:userId", async (req, res) => {
  const { userId } = req.params;

  // Carrega perfil com cache
  const profile = await getUserProfile(userId);

  res.json({
    profile,
    timestamp: new Date(),
  });
});
```

## ⚠️ Erros comuns

### Erro 1: Sem userid na chave

```ts
// ❌ PERIGOSO: Dois users compartilham cache!
const cache = createCache<UserSettings>();

e export async function getSettings(userId: string) {
  return cache.fetch("settings", fetchSettingsFromAPI);  // Sem userId!
  // User A chama: busca e grava
  // User B chama: recebe dados de User A! ❌
}

// ✅ Correto: userId na chave
export async function getSettings(userId: string) {
  return cache.fetch(
    `user:${userId}:settings`,  // 👈 SEMPRE incluir userId
    fetchSettingsFromAPI
  );
}
```

### Erro 2: Invalidar tudo quando só precisa de um user

```ts
// ❌ Ruim: Clear TUDO quando um user muda
export async function updateSettings(userId: string, updates: any) {
  await updateAPI(userId, updates);
  userCache.clear();  // Remove todos os 10k users!
}

// ✅ Melhor: Invalidar só esse user
export async function updateSettings(userId: string, updates: any) {
  await updateAPI(userId, updates);
  userCache.invalidateTag(`user:${userId}`);  // Remove só esse
}
```

### Erro 3: TTL muito alto para dados pessoais

```ts
// ❌ Ruim: User muda tema mas continua com tema antigo por 1 hora
const cache = createCache({ defaultTTL: 60 * 60_000 });  // 1 hora!

// ✅ Correto: TTL razoável para dados que mudam
const cache = createCache({ defaultTTL: 5 * 60_000 });  // 5 minutos
```

## 💡 Boas práticas

### 1. Use prefixo consistente

```ts
// Boa pattern:
cache.fetch(`user:${userId}:settings`, ...)
cache.fetch(`user:${userId}:profile`, ...)
cache.fetch(`user:${userId}:notifications`, ...)

// Depois: invalida tudo com
cache.invalidateTag(`user:${userId}`);
```

### 2. SWR para melhor UX

```ts
// User vê dados antigos em 1ms, recebe atualização em background
return userCache.fetch(key, fetch, {
  stale: true,
  ttl: 5 * 60_000,
});
```

### 3. Limite maxEntries

```ts
const cache = createCache({
  maxEntries: 5_000,  // Max 5k users simultâneos
  defaultTTL: 5 * 60_000,
});

// Se exceder 5k, remove usuários menos acessados
```

### 4. Invalidar ao logout

```ts
app.post("/api/logout", async (req, res) => {
  const { userId } = req.user;
  
  // Remove dados do cache
  userCache.invalidateTag(`user:${userId}`);
  
  // Remove sessão do servidor
  await sessions.delete(userId);
  
  res.json({ ok: true });
});
```

## 🔗 Próximos passos

- [Multi-tenant Cache](/docs/guides/multi-tenant-cache) - Isolação em escala
- [API: invalidateTag](/docs/api/invalidate-tag) - Invalidação avançada
- [Performance](/docs/performance-boas-praticas) - TTL strategies
```
