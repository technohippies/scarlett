import presetWind4 from '@unocss/preset-wind4'
import { defineConfig } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      border: "hsl(216 12.2% 83.9%)",
      input: "hsl(230 8% 16%)",
      ring: "hsl(216 12.2% 70%)",
      background: "hsl(240 4.8% 9.8%)",
      foreground: "hsl(210 40% 98%)",
      primary: {
        DEFAULT: "hsl(210 40% 98%)",
        foreground: "hsl(240 4.8% 9.8%)",
      },
      secondary: {
        DEFAULT: "hsl(230 8% 16%)",
        foreground: "hsl(210 40% 98%)",
      },
      destructive: {
        DEFAULT: "hsl(0 62.8% 30.6%)",
        foreground: "hsl(210 40% 98%)",
      },
      muted: {
        DEFAULT: "hsl(230 8% 16%)",
        foreground: "hsl(0 0% 64%)",
      },
      accent: {
        DEFAULT: "hsl(230 8% 16%)",
        foreground: "hsl(210 40% 98%)",
      },
      popover: {
        DEFAULT: "hsl(240 4.8% 9.8%)",
        foreground: "hsl(210 40% 98%)",
      },
      card: {
        DEFAULT: "hsl(240 4.8% 9.8%)",
        foreground: "hsl(210 40% 98%)",
      },
    },
    // Removed borderRadius to resolve linter error
    // borderRadius: {
    //   lg: "0.5rem", // var(--radius)
    //   md: "calc(0.5rem - 2px)", // calc(var(--radius) - 2px)
    //   sm: "calc(0.5rem - 4px)", // calc(var(--radius) - 4px)
    // },
    // Add other theme properties like spacing, font sizes, etc. as needed
  },
  preflights: [
    {
      getCSS: () => `
        input[role="combobox"] {
          outline: none !important;
          box-shadow: none !important;
        }
      `
    }
  ]
}) 