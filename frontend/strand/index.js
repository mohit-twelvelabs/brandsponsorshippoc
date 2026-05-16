/**
 * @twelvelabs/strand — Main Entry Point
 *
 * Exports the Tailwind preset and raw token data.
 *
 * Note: Uses CommonJS internally for Tailwind v3 (jiti) compatibility.
 */

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function loadToken(file) {
  return JSON.parse(readFileSync(join(__dirname, 'tokens', file), 'utf-8'))
}

const strandPreset = require('./tailwind-preset.js')

// Re-export raw token data for programmatic access
const colors = loadToken('colors.json')
const typography = loadToken('typography.json')
const spacing = loadToken('spacing.json')
const radii = loadToken('radii.json')
const shadows = loadToken('shadows.json')

module.exports = { strandPreset, colors, typography, spacing, radii, shadows }
