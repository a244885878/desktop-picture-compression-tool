import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "path";

// https://vite.dev/config/
export default defineConfig(() => {
  const isElectron = process.env.ELECTRON === "true";

  const plugins = [react()];

  // 只有在 Electron 模式下才添加 electron 插件
  if (isElectron) {
    plugins.push(
      electron([
        {
          // 主进程入口文件
          entry: "src/electron/main.ts",
          vite: {
            resolve: {
              alias: {
                "@": path.resolve(__dirname, "src"),
              },
            },
            build: {
              rollupOptions: {
                external: ["electron", "sharp"],
              },
              outDir: "dist-electron",
            },
          },
        },
        {
          // 预加载脚本配置
          entry: "src/electron/preload.ts",
          vite: {
            resolve: {
              alias: {
                "@": path.resolve(__dirname, "src"),
              },
            },
            build: {
              rollupOptions: {
                external: ["electron", "sharp"],
              },
              outDir: "dist-electron",
            },
          },
          onstart(options) {
            // 预加载脚本热重启时会触发主进程重启
            options.reload();
          },
        },
      ])
    );
  }

  return {
    plugins,
    // 设置为相对路径，避免Electron中的绝对路径问题
    base: "./",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    optimizeDeps: {
      exclude: ["sharp"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      port: 8080,
    },
  };
});
