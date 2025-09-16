// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
    },
  },
  plugins: [],
} satisfies Config;
