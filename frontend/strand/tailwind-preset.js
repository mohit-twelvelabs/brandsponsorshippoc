// @twelvelabs/strand — Tailwind CSS Preset
//
// Usage in any app's tailwind.config.js:
//
//   import strandPreset from '../../../packages/strand/tailwind-preset.js'
//   export default {
//     presets: [strandPreset],
//     content: ['./src/**/*.{js,ts,jsx,tsx}'],
//   }
//
// Uses CommonJS internally for Tailwind v3 (jiti) compatibility.
// Dark mode: add class="dark" to <html> to activate dark theme.

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function loadToken(file) {
  return JSON.parse(readFileSync(join(__dirname, 'tokens', file), 'utf-8'))
}

const colors = loadToken('colors.json')
const typography = loadToken('typography.json')
const spacing = loadToken('spacing.json')
const radii = loadToken('radii.json')
const shadows = loadToken('shadows.json')

// ---------------------------------------------------------------------------
// CSS Custom Property definitions for light/dark semantic colors
// ---------------------------------------------------------------------------

// Light mode values (default)
const lightVars = {
  '--strand-background': colors.ui.background.value,
  '--strand-surface': colors.ui.surface.value,
  '--strand-card': colors.ui.card.value,
  '--strand-text-primary': colors.ui.text.primary.value,
  '--strand-text-secondary': colors.ui.text.secondary.value,
  '--strand-text-tertiary': colors.ui.text.tertiary.value,
  '--strand-text-inverse': colors.ui.text.inverse.value,
  '--strand-border': colors.ui.border.default.value,
  '--strand-border-light': colors.ui.border.light.value,
  '--strand-accent': colors.ui.accent.default.value,
  '--strand-accent-hover': colors.ui.accent.hover.value,
  '--strand-accent-light': colors.ui.accent.light.value,
}

// Dark mode overrides
const darkVars = {
  '--strand-background': colors.dark.background.value,
  '--strand-surface': colors.dark.surface.value,
  '--strand-card': colors.dark.card.value,
  '--strand-text-primary': colors.dark.text.primary.value,
  '--strand-text-secondary': colors.dark.text.secondary.value,
  '--strand-text-tertiary': colors.dark.text.tertiary.value,
  '--strand-text-inverse': colors.dark.text.inverse.value,
  '--strand-border': colors.dark.border.default.value,
  '--strand-border-light': colors.dark.border.light.value,
  '--strand-accent': colors.dark.accent.default.value,
  '--strand-accent-hover': colors.dark.accent.hover.value,
  '--strand-accent-light': colors.dark.accent.light.value,
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // Brand palette (for marketing/brand use — static, no dark mode swap)
        'brand-green': colors.brand.green.value,
        'brand-charcoal': colors.brand.charcoal.value,
        'brand-white': colors.brand.white.value,
        'brand-grey': colors.brand.grey.value,

        // Masterbrand colors (Figma: Foundation/Masterbrand Color — static)
        'mb-green': colors.masterbrand.green.value,
        'mb-green-dark': colors.masterbrand.greenDark.value,
        'mb-green-light': colors.masterbrand.greenLight.value,
        'mb-orange': colors.masterbrand.orange.value,
        'mb-orange-dark': colors.masterbrand.orangeDark.value,
        'mb-orange-light': colors.masterbrand.orangeLight.value,
        'mb-peach': colors.masterbrand.peach.value,
        'mb-peach-dark': colors.masterbrand.peachDark.value,
        'mb-peach-light': colors.masterbrand.peachLight.value,
        'mb-pink': colors.masterbrand.pink.value,
        'mb-pink-dark': colors.masterbrand.pinkDark.value,
        'mb-pink-light': colors.masterbrand.pinkLight.value,

        // Gray ramp (Figma Variables: Gray50-Gray700 — static)
        gray: {
          50: colors.gray['50'].value,
          100: colors.gray['100'].value,
          200: colors.gray['200'].value,
          300: colors.gray['300'].value,
          400: colors.gray['400'].value,
          500: colors.gray['500'].value,
          600: colors.gray['600'].value,
          700: colors.gray['700'].value,
        },

        // Semantic UI colors — reference CSS custom properties for dark mode
        background: 'var(--strand-background)',
        surface: 'var(--strand-surface)',
        card: 'var(--strand-card)',
        'text-primary': 'var(--strand-text-primary)',
        'text-secondary': 'var(--strand-text-secondary)',
        'text-tertiary': 'var(--strand-text-tertiary)',
        'text-inverse': 'var(--strand-text-inverse)',
        border: 'var(--strand-border)',
        'border-light': 'var(--strand-border-light)',
        accent: {
          DEFAULT: 'var(--strand-accent)',
          hover: 'var(--strand-accent-hover)',
          light: 'var(--strand-accent-light)',
        },

        // Static semantic colors (no dark mode swap needed)
        highlight: colors.ui.highlight.value,
        error: {
          dark: colors.system.error.dark.value,
          DEFAULT: colors.ui.error.value,
          light: colors.system.error.light.value,
        },
        warning: {
          dark: colors.system.warning.dark.value,
          DEFAULT: colors.ui.warning.value,
          light: colors.system.warning.light.value,
        },
        success: {
          dark: colors.system.success.dark.value,
          DEFAULT: colors.ui.success.value,
          light: colors.system.success.light.value,
        },
        info: {
          dark: colors.system.info.dark.value,
          DEFAULT: colors.ui.info.value,
          light: colors.system.info.light.value,
        },
        destructive: colors.ui.destructive.value,

        // Product line colors (Search, Generate, Embed — static)
        'product-search': {
          dark: colors.product.search.dark.value,
          DEFAULT: colors.product.search.DEFAULT.value,
          light: colors.product.search.light.value,
        },
        'product-generate': {
          dark: colors.product.generate.dark.value,
          DEFAULT: colors.product.generate.DEFAULT.value,
          light: colors.product.generate.light.value,
        },
        'product-embed': {
          dark: colors.product.embed.dark.value,
          DEFAULT: colors.product.embed.DEFAULT.value,
          light: colors.product.embed.light.value,
        },

        // User message (charcoal bg, white text — static)
        'user-bg': colors.brand.charcoal.value,
        'user-text': '#FFFFFF',
      },

      fontFamily: {
        brand: typography.fontFamily.brand.value,
        'brand-bold': typography.fontFamily.brandBold.value,
        'brand-xbold': typography.fontFamily.brandXBold.value,
        system: typography.fontFamily.system.value,
        geist: typography.fontFamily.geist.value,
        mono: typography.fontFamily.mono.value,
      },

      fontSize: Object.fromEntries(
        Object.entries(typography.fontSize).map(([key, token]) => [
          key,
          [
            `${token.value}px`,
            {
              lineHeight: String(token.lineHeight),
              fontWeight: String(token.fontWeight),
              ...(token.letterSpacing ? { letterSpacing: `${token.letterSpacing}px` } : {}),
            },
          ],
        ])
      ),

      spacing: {
        ...Object.fromEntries(
          Object.entries(spacing.spacing).map(([key, token]) => [key, `${token.value}px`])
        ),
        header: `${spacing.sizing.header.value}px`,
        sidebar: `${spacing.sizing.sidebar.value}px`,
        'chat-max': `${spacing.sizing.chatMax.value}px`,
        'content-max': `${spacing.sizing.contentMax.value}px`,
      },

      borderRadius: Object.fromEntries(
        Object.entries(radii.borderRadius).map(([key, token]) => [key, `${token.value}px`])
      ),

      boxShadow: Object.fromEntries(
        Object.entries(shadows.boxShadow).map(([key, token]) => [key, token.value])
      ),
    },
  },

  plugins: [
    // Inject CSS custom properties for light and dark mode.
    // Uses raw plugin function (no require('tailwindcss/plugin') needed)
    // so jiti can resolve this from any consuming project.
    function strandDarkMode({ addBase }) {
      addBase({
        ':root': lightVars,
        '.dark': darkVars,
      })
    },
  ],
}
