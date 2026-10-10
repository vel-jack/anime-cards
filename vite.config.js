import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths, so the build works under any GitHub Pages repo name.
  base: './',
  plugins: [tailwindcss()],
})
