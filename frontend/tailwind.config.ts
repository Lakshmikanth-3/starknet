import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                btc: {
                    400: "#F6931A", // Bitcoin Orange
                    500: "#E88310",
                }
            },
            fontFamily: {
                mono: ['var(--font-mono)'],
                sans: ['var(--font-sans)'],
            }
        },
    },
    plugins: [],
};
export default config;
