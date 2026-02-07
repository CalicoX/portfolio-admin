/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Geist Mono"', 'monospace'],
                mono: ['"Geist Mono"', 'monospace'],
            },
            colors: {
                background: '#09090b',
                surface: '#18181b',
                primary: {
                    DEFAULT: '#fafafa',
                    foreground: '#18181b',
                },
                secondary: {
                    DEFAULT: '#a1a1aa',
                    foreground: '#fafafa',
                },
                accent: {
                    DEFAULT: '#22c55e',
                    foreground: '#ffffff',
                },
                // Shadcn specific mappings
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                // Use CSS variables for shadcn colors too
                foreground: "hsl(var(--foreground))",
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'blink': 'blink 1s step-end infinite',
                'shake-glow': 'shakeGlow 0.15s ease-in-out infinite',
                'shimmer': 'shimmer 1.5s ease-in-out infinite',
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                blink: {
                    '0%, 50%': { opacity: '1' },
                    '51%, 100%': { opacity: '0' },
                },
                shakeGlow: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-1px)' },
                    '75%': { transform: 'translateX(1px)' },
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
