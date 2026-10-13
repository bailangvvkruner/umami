import { bindings, defineConfig } from '@cloudflare/config/public';

export default defineConfig({
  accountId: '58d3fb784769621761688096f987f91c',
  worker: {
    name: 'umami',
    compatibilityDate: '2026-08-28',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'vinext/server/fetch-handler',
    workersDev: true,
    previewUrls: false,
    observability: {
      enabled: true,
    },
    assets: {
      notFoundHandling: 'none',
    },
    domains: ['umami.520613.xyz'],
    env: {
      APP_SECRET: bindings.secret(),
      TWO_FACTOR_ENCRYPTION_KEY: bindings.secret(),
      DB: bindings.d1({
        name: 'umami',
        id: '88e3f448-8dd6-44ab-869c-42dad77b1141',
      }),
      ASSETS: bindings.assets(),
    },
  },
});
