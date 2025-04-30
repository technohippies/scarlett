import presetWind4 from '@unocss/preset-wind4'
import { defineConfig } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      border: "hsl(0 0% 89.8%)",
      input: "hsl(0 0% 89.8%)",
      ring: "hsl(0 0% 63.9%)",
      background: "hsl(0 0% 100%)",
      foreground: "hsl(0 0% 9%)",
      primary: {
        DEFAULT: "hsl(0 0% 9%)",
        foreground: "hsl(0 0% 98%)",
      },
      secondary: {
        DEFAULT: "hsl(0 0% 96.1%)",
        foreground: "hsl(0 0% 9%)",
      },
      destructive: {
        DEFAULT: "hsl(0 84.2% 60.2%)",
        foreground: "hsl(0 0% 98%)",
      },
      muted: {
        DEFAULT: "hsl(0 0% 96.1%)",
        foreground: "hsl(0 0% 45.1%)",
      },
      accent: {
        DEFAULT: "hsl(0 0% 96.1%)",
        foreground: "hsl(0 0% 9%)",
      },
      popover: {
        DEFAULT: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 9%)",
      },
      card: {
        DEFAULT: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 9%)",
      },
    },
    radius: {
      lg: "0.5rem",
      md: "calc(0.5rem - 2px)",
      sm: "calc(0.5rem - 4px)",
    },
    // Add other theme properties like spacing, font sizes, etc. as needed
  }
}) 