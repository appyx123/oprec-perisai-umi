// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

// https://astro.build/config
export default defineConfig({
  // Full SSR — semua halaman dirender di Cloudflare Workers/Pages Functions
  output: 'server',

  integrations: [
    sentry({
      project: 'javascript-astro',
      org: 'perisai-umi-tech',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],

  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
  },
});
