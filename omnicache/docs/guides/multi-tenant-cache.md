---
title: Multi-tenant Cache
---

# Multi-tenant Cache

## 🧠 O Conceito

Multi-tenant = múltiplos clientes (empresas) compartilham mesma infraestrutura. Cache de um cliente nunca pode vazar para outro!

## ❓ Por que existe

- SaaS = múltiplas empresas na mesma app
- Isolamento é obrigatório (segurança, compliance)
- Sem isolamento: Empresa A vê dados de Empresa B

## ✅ Quando usar

- Aplicação SaaS multi-cliente
- Cada cliente tem dados isolados
- Precisa compartilhar cache root entre tenants

## 🚫 Quando NÃO usar

- Uma única empresa (use single cache)
- Dados já isolados por userId (cache por usuário é suficiente)

## ⚡ Exemplo mínimo funcional

```ts
import { createCache } from "omnicache";

type CompanyBilling = {
  month: string;
  amount: number;
  status: "paid" | "due" | "overdue";
};

// Cache raiz (compartilhado entre todos tenants)
const rootCache = createCache<CompanyBilling>({
  defaultTTL: 30_000,
});

// Criar namespace por tenant
function getTenantCache(tenantId: string) {
  return rootCache.namespace(`tenant:${tenantId}`);
}

export async function getBilling(
  tenantId: string
): Promise<CompanyBilling> {
  const cache = getTenantCache(tenantId);
  
  return cache.fetch(
    "billing",  // 👈 Simples! Já isolado por namespace
    async () => {
      const res = await fetch(`/api/billing/${tenantId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
  );
}

// Uso
const acmeCorp = await getBilling("acme-corp");
const techStart = await getBilling("tech-start");

// Cada um tem seu próprio cache
// **Garantido**: techStart NUNCA recebe dados de acmeCorp ✅
```

## 🧩 Exemplo real: SaaS com múltiplos workspaces

Plataforma de CRM com múltiplos clientes. Cada cliente pode ter múltiplas "workspaces":

```ts
import { createCache } from "omnicache";

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
};

type CompanyStats = {
  totalContacts: number;
  leadScoreAvg: number;
  conversionRate: number;
};

// Cache raiz
const crm = createCache<any>({
  defaultTTL: 5 * 60_000,  // 5 minutos
  maxEntries: 50_000,      // Suporte para muitos tenants
});

// Namespace por tenant
function getTenantCache(tenantId: string) {
  return crm.namespace(`tenant:${tenantId}`);
}

// Dentro do tenant, pode ter múltiplos tipos
export async function getContacts(
  tenantId: string,
  limit: number = 100
): Promise<Contact[]> {
  const cache = getTenantCache(tenantId);
  
  return cache.fetch(
    `contacts:${limit}`,
    async () => {
      const res = await fetch(`/api/crm/contacts?limit=${limit}`, {
        headers: { "X-Tenant-ID": tenantId },
      });
      return res.json();
    },
    { tags: ["crs", `crm:contacts`] }  // Para invalidação
  );
}

export async function getCompanyStats(
  tenantId: string
): Promise<CompanyStats> {
  const cache = getTenantCache(tenantId);
  
  return cache.fetch(
    "stats",
    async () => {
      const res = await fetch(`/api/crm/stats`, {
        headers: { "X-Tenant-ID": tenantId },
      });
      return res.json();
    },
    { stale: true, tags: ["crm", "crm:stats"] }
  );
}

// Invalidação por tenant
export function invalidateTenantCache(tenantId: string) {
  // Remove TUDO desse tenant
  const cache = getTenantCache(tenantId);
  cache.clear();
}

// Invalidação parcial (ex: contatos mudaram)
export function invalidateContacts(tenantId: string) {
  const cache = getTenantCache(tenantId);
  cache.invalidateTag("crm:contacts");
}

// Endpoint
app.get("/api/crm/dashboard", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] as string;
  
  if (!tenantId) {
    return res.status(400).json({ error: "Missing X-Tenant-ID" });
  }

  const [contacts, stats] = await Promise.all([
    getContacts(tenantId),
    getCompanyStats(tenantId),
  ]);

  res.json({ contacts, stats });
});
```

## ⚠️ Erros comuns

### Erro 1: Sem namespace

```ts
// ❌ CRÍTICO: Dois tenants compartilham cache!
const cache = createCache();

export async function getContacts(tenantId: string) {
  return cache.fetch("contacts", fetchContacts);  // Sem tenantId!
  // Tenant A: busca e grava
  // Tenant B: recebe dados de Tenant A! ❌ VAZA DADOS
}

// ✅ Correto: Namespace por tenant
const rootCache = createCache();

export async function getContacts(tenantId: string) {
  const cache = rootCache.namespace(`tenant:${tenantId}`);
  return cache.fetch("contacts", fetchContacts);
  // Cada tenant tem seu próprio isolamento
}
```

### Erro 2: Clear demais

```ts
// ❌ Ruim: Limpar TUDO quando um tenant muda
export function handleTenantUpdate(tenantId: string) {
  rootCache.clear();  // Remove cache de TODOS tenants!
}

// ✅ Correto: Limpar só esse tenant
export function handleTenantUpdate(tenantId: string) {
  const cache = rootCache.namespace(`tenant:${tenantId}`);
  cache.clear();  // Remove só desse tenant
}
```

### Erro 3: maxEntries sem limite

```ts
// ❌ Ruim: 1000 tenants × 1000 chaves = 1Mi registros na memória
const cache = createCache({ maxEntries: 1_000_000 });  // Muito!

// ✅ Melhor: Balancear entre memória e performance
const cache = createCache({
  maxEntries: 50_000,  // ~500 tenants × 100 chaves cada
  defaultTTL: 5 * 60_000,
});
```

## 💡 Boas práticas

### 1. Sempre usar namespace

```ts
// Pattern:
function getTenantCache(tenantId: string) {
  return rootCache.namespace(`tenant:${tenantId}`);
}

// Uso:
const cache = getTenantCache(req.tenantId);
```

### 2. Validar tenantId

```ts
export async function getContacts(tenantId: string) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Invalid tenantId");
  }

  const cache = getTenantCache(tenantId);
  return cache.fetch("contacts", fetchContacts);
}
```

### 3. Usar tags para invalidação fina

```ts
return cache.fetch(key, fetch, {
  tags: ["crm", "crm:contacts", "crm:contacts:list"],
});

// Depois:
cache.invalidateTag("crm:contacts");  // Remove só contatos
```

### 4. Monitorar por tenant

```ts
app.get("/api/admin/cache-stats/:tenantId", (req, res) => {
  const tenantId = req.params.tenantId;
  const cache = rootCache.namespace(`tenant:${tenantId}`);
  const stats = cache.stats();
  
  res.json(stats);
});
```

## 🔗 Próximos passos

- [Cache por Usuário](/docs/guides/cache-por-usuario) - Isolação em escala de usuário
- [API: namespace](/docs/api/namespace) - Documentação da função
- [Security Best Practices](/docs/performance-boas-praticas) - Recomendações
```
