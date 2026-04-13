import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@feynman/core": resolve(import.meta.dirname, "../../packages/feynman-core/src/index.ts"),
      "@feynman/react": resolve(import.meta.dirname, "../../packages/feynman-react/src/index.tsx"),
      "@feynman/editor": resolve(import.meta.dirname, "../../packages/feynman-editor/src/index.tsx")
    }
  }
});