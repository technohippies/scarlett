import presetWind4 from '@unocss/preset-wind4'
import { defineConfig } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      border: "hsl(240 4.8% 13%)",
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
        DEFAULT: "hsl(0 62.8% 55%)",
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
        DEFAULT: "hsl(240 4.8% 13%)",
        foreground: "hsl(210 40% 98%)",
      },
      sidebar: {
        DEFAULT: "hsl(240 5.9% 10%)", // dark mode background
        foreground: "hsl(240 4.8% 95.9%)", // dark mode foreground
        primary: "hsl(224.3 76.3% 48%)", // dark mode primary
        "primary-foreground": "hsl(0 0% 100%)", // dark mode primary-foreground
        accent: "hsl(240 3.7% 15.9%)", // dark mode accent
        "accent-foreground": "hsl(240 4.8% 95.9%)", // dark mode accent-foreground
        border: "hsl(240 3.7% 15.9%)", // dark mode border
        ring: "hsl(217.2 91.2% 59.8%)", // dark mode ring
      },
      "border-secondary": "hsl(240 4.8% 18%)", // Slightly lighter than primary border
      "border-tertiary": "hsl(240 4.8% 23%)", // Even lighter, for less emphasis
    },
    spacing: {
      // Add standard spacing values needed
      '4': "1rem",    // 16px
      '6': "1.5rem",  // 24px
      '8': "2rem",    // 32px
      '12': "3rem",   // 48px
      // Add other values as needed
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
      getCSS: ({ theme }) => `
        html,
        body,
        #root {
          height: 100%;
          /* Add nullish coalescing or default values to fix linter */
          background-color: ${theme?.colors?.background ?? '#000'};
          color: ${theme?.colors?.foreground ?? '#fff'};
        }
        /* Original preflights */
        input[role="combobox"] {
          outline: none !important;
          box-shadow: none !important;
        }
      `
    },
    {
      getCSS: () => `
        body {
          font-size: 100%; /* Override injected style */
          -webkit-font-smoothing: antialiased; /* Common reset */
          -moz-osx-font-smoothing: grayscale; /* Common reset */
        }
      `
    }
  ]
}) 