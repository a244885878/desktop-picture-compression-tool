import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import electron from "vite-plugin-electron";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // 主进程入口文件
        entry: "electron/main.ts",
      },
      {
        // 预加载脚本配置
        entry: "electron/preload.ts",
        onstart(options) {
          // 预加载脚本热重启时会触发主进程重启
          options.reload();
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
