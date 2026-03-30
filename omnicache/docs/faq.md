---
title: FAQ
---

# FAQ

## 1) O cache não atualiza. O que pode ser?

As causas mais comuns são:

- TTL muito alto para o tipo de dado.
- Chave incorreta (exemplo: esqueceu `userId` e reaproveitou dado de outro contexto).
- Uso de `stale: true` sem entender que ele retorna o valor antigo e atualiza em segundo plano.

Checklist rápido:

1. Verifique o `ttl` configurado.
2. Confirme se a chave contém os identificadores corretos.
3. Se quiser forçar atualização imediata, use `refresh`.

## 2) Quando usar `fetch`, `get`, `set` e `refresh`?

- `fetch`: caminho padrão. Busca no cache e, se necessário, executa a função para popular.
- `get`: leitura direta sem executar função.
- `set`: gravação manual.
- `refresh`: força recomputar e atualizar o valor mesmo com entrada válida.

## 3) Como escolher TTL?

Regra prática inicial:

- Dados muito dinâmicos: 3s a 15s.
- Dados de API externa: 30s a 120s.
- Configuração e metadados estáveis: 5min ou mais.

Comece simples, monitore `hits`/`misses` em `stats()` e ajuste com dados reais.

## 4) O que é deduplicação na prática?

Quando várias requisições pedem a mesma chave ao mesmo tempo, o OmniCache roda apenas uma execução real e compartilha o resultado com as demais.

Isso reduz custo de upstream e ajuda a evitar rate limit.

## 5) Posso usar em ambiente com múltiplas instâncias?

Sim, mas lembrando: o cache é local por processo.

Em múltiplas instâncias/containers:

- Use OmniCache como camada local (L1).
- Se precisar compartilhamento global, adicione Redis/Memcached como L2.

## 6) Como evitar vazamento de dados entre usuários/tenants?

Padronize chaves e namespace.

Exemplo de chave por usuário:

```ts
`user:${userId}:profile`
```

Exemplo de namespace por tenant:

```ts
root.namespace(`tenant:${tenantId}`)
```

## 7) `invalidateTag` ou `invalidatePrefix`?

- `invalidateTag`: melhor quando você quer invalidar por agrupamento lógico (ex.: todos os posts de um autor).
- `invalidatePrefix`: melhor quando você tem uma convenção clara de chave por prefixo.

Se os dados não têm prefixo previsível, prefira tag.

## 8) Como observar se o cache está saudável?

Monitore `stats()` periodicamente:

- `hits`, `misses`, `staleHits`
- `size`
- `pending`

Sinais de alerta:

- Hit rate muito baixo por muito tempo.
- `pending` sempre alto.
- Crescimento de `size` sem controle (ajustar `maxEntries`/sweep).

## 9) Como fazer limpeza segura no desligamento da aplicação?

Se você usa varredura periódica (sweep), chame `dispose()` no encerramento para liberar timers internos.

## 10) OmniCache funciona com JavaScript puro?

Sim. Você pode usar sem TypeScript.

TypeScript é opcional e ajuda com autocomplete, contratos de dados e segurança em refatorações.

## 11) Qual fluxo recomendado para começar?

1. Leia [Introdução](/docs/intro).
2. Rode [Quick Start](/docs/quick-start).
3. Entenda [Conceitos Principais](/docs/conceitos-principais).
4. Vá para os guias do seu cenário real em [Guias Práticos](/docs/guides/cacheando-api-externa).

## 12) Onde reportar problemas e melhorias?

Abra uma issue no repositório do projeto:

- [GitHub](https://github.com/mitsukiie/OmniCache)
