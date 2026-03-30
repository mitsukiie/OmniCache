import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Primeiros Passos',
      items: [
        'intro',
        'quick-start',
        'conceitos-principais',
      ],
    },
    {
      type: 'category',
      label: 'Referência de API',
      items: [
        'api/cache',
        'api/create-cache',
        'api/fetch',
        'api/get',
        'api/set',
        'api/delete',
        'api/clear',
        'api/refresh',
        'api/wrap',
        'api/namespace',
        'api/stats',
        'api/invalidate-tag',
        'api/invalidate-prefix',
        'api/hooks',
        'api/config-options',
      ],
    },
    {
      type: 'category',
      label: 'Guias Práticos',
      items: [
        'guides/cacheando-api-externa',
        'guides/cache-para-bot-discord',
        'guides/evitando-rate-limit',
        'guides/multi-tenant-cache',
        'guides/cache-por-usuario',
        'guides/swr-explicado-visualmente',
        'guides/debug-e-observabilidade',
      ],
    },
    {
      type: 'category',
      label: 'Suporte e Boas Práticas',
      items: [
        'javascript-vs-typescript',
        'performance-boas-praticas',
        'faq',
      ],
    },
  ],
};

export default sidebars;
