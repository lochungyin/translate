// tailwind.config.js
const { nextui } = require('@nextui-org/react');

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        // ...
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {},
    },
    darkMode: 'class',
    plugins: [
        nextui({
            themes: {
                dark: {
                    colors: {
                        background: '#141c17',
                        foreground: '#e7eee9',
                        content1: '#1d2921',
                        content2: '#26362b',
                        content3: '#34483a',
                        content4: '#425a49',
                        default: {
                            DEFAULT: '#526a58',
                            50: '#1d2921',
                            100: '#34483a',
                            200: '#526a58',
                            300: '#585858',
                            400: '#686868',
                            500: '#a7a7a7',
                            600: '#b7b7b7',
                            700: '#c7c7c7',
                            800: '#d7d7d7',
                            900: '#e7eee9',
                        },
                        primary: {
                            DEFAULT: '#8bd5a9',
                            foreground: '#24362c',
                        },
                    },
                },
                light: {
                    colors: {
                        background: '#f8faf9',
                        foreground: '#24362c',
                        content1: '#ffffff',
                        content2: '#f1f5f2',
                        content3: '#dfe6e2',
                        content4: '#c8d3cc',
                        default: {
                            DEFAULT: '#999999',
                            50: '#ffffff',
                            100: '#dfe6e2',
                            200: '#aaaaaa',
                            300: '#999999',
                            400: '#888888',
                            500: '#686868',
                            600: '#585858',
                            700: '#526a58',
                            800: '#34483a',
                            900: '#1d2921',
                        },
                        primary: {
                            foreground: '#ffffff',
                            DEFAULT: '#23664a',
                        },
                    },
                },
            },
        }),
    ],
};
