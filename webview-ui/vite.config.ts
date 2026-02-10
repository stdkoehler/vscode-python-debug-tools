import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  return {
    base: "./",
    plugins: [react()],
    resolve: {
      alias: {
        "@common": resolve(__dirname, "../common"),
      },
    },
    build: {
      outDir: "../media",
      emptyOutDir: true,
      // debug webview in Open Webview Developer Tools -> Source
      sourcemap: isDev ? "inline" : false,
      assetsDir: "assets",
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
        output: {
          entryFileNames: `assets/index.js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
    },
  };
});
