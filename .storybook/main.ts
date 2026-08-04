import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/nextjs-vite"
import { mergeConfig } from "vite"

const siteConfigPath = fileURLToPath(new URL("../site.config.js", import.meta.url))
const siteConfigAdapterPath = fileURLToPath(new URL("./site-config.ts", import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: {
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
