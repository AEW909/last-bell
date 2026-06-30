import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// base: "./" emits relative asset URLs so the build works when served from a
// GitHub Pages project subpath (e.g. /last-bell/) as well as from root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
