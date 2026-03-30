# FlowCache
![npm](https://img.shields.io/npm/v/flowcache)
![downloads](https://img.shields.io/npm/dm/flowcache)
![license](https://img.shields.io/npm/flowcache)
![types](https://img.shields.io/npm/types/flowcache)

Cache em memória moderno para Node.js

✅ Deduplicação de requisições concorrentes  
✅ Stale-while-revalidate  
✅ Tipagem automática com TypeScript  
✅ API simples e sem boilerplate

✅ Estatísticas, invalidação avançada, hooks e namespace dinâmico

## 🚀 Quick Start
```js
const { createCache } = require("flowcache");

const cache = createCache({
  user: {
    profile: {},
  },
});

await cache.user.profile.fetch("1", async () => {
  const res = await fetch("https://api.example.com/user/1");
  return res.json();
});
```

## 📚 Documentação

- Repositório: https://github.com/mitsukiie/FlowCache
- Documentação: https://flowcache.vercel.app/docs/intro

Para manter este README objetivo, os exemplos avançados e a referência completa da API ficam centralizados na documentação.

## 🔥 Principais recursos

- TTL por item
- Stale-while-revalidate
- Deduplicação automática
- Cache tags
- Namespaces
- Hooks e observabilidade
- Zero dependências

## ✨ Por que FlowCache?

- Sem configuração obrigatória
- Tipagem automática
- Evita requisições duplicadas
- API minimalista
- Observabilidade opcional

## 🧱 Compatibilidade

- Node.js >= 20
- ESM e CommonJS

## 📦 Instalação

```bash
npm install flowcache
```

## 🔎 Próximos passos

- Guia de início rápido: [Quick Start](https://flowcache.vercel.app/docs/quick-start)
- Referência da API: [API de Cache](https://flowcache.vercel.app/docs/api/cache)
- Guias práticos: [Guides](https://flowcache.vercel.app/docs/category/guides)

Os exemplos detalhados (TypeScript, namespaces, invalidação por tag/prefixo, hooks e wrap) estão documentados nesses links.

## 💡 Quando usar?

- APIs externas
- Bots Discord
- Dashboards
- Microservices
- Rate-limit protection

## ⚠️ Cache em memória

Cada processo possui seu próprio cache.

Para cache compartilhado entre múltiplos serviços,
use Redis como camada adicional.