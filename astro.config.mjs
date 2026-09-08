// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Full SSR — semua halaman dirender di Cloudflare Workers/Pages Functions
  output: 'server',

  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
  },
});
