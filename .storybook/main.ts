import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"
import react from "@vitejs/plugin-react-swc"
import { mergeConfig } from "vite"

const siteConfigPath = fileURLToPath(new URL("../site.config.js", import.meta.url))
const siteConfigAdapterPath = fileURLToPath(new URL("./site-config.ts", import.meta.url))
const nextFontLocalAdapterPath = fileURLToPath(new URL("./next-font-local.ts", import.meta.url))
const nextLinkAdapterPath = fileURLToPath(new URL("./next-link.tsx", import.meta.url))
const nextRouterAdapterPath = fileURLToPath(new URL("./next-router.ts", import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [react()],
      publicDir: false,
      resolve: {
        alias: {
          "next/font/local": nextFontLocalAdapterPath,
          "next/link": nextLinkAdapterPath,
          "next/router": nextRouterAdapterPath,
          "site.config": siteConfigAdapterPath,
        },
      },
      optimizeDeps: {
        include: ["site.config"],
      },
      build: {
        commonjsOptions: {
          include: [/node_modules/, siteConfigPath],
        },
      },
    }),
}

export default config
