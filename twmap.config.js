// Example twmap.config.js
module.exports = {
  // Input file patterns to scan for class names
  input: [
    './src/**/*.{tsx,jsx,html}',
    './components/**/*.{tsx,jsx}',
    './examples/**/*.{tsx,jsx,html}',
    './app/**/*.{tsx,jsx,html}',
    './pages/**/*.{tsx,jsx,html}',
    './layouts/**/*.{tsx,jsx,html}'
  ],

  // Output path for the generated CSS file
  output: './twmap.css',

  // Class name generation mode
  // 'hash' - generates short hash-based names (e.g., 'tw-a1b2c3')
  // 'incremental' - generates incremental names (e.g., 'tw-0', 'tw-1')
  // 'readable' - generates somewhat readable names (e.g., 'tw-textcenter')
  mode: 'hash',

  // Prefix for all generated class names
  prefix: 'twmap-',

  // Patterns to ignore during scanning
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}'
  ],

  // Enable CSS compression/minification for the output CSS file
  cssCompressor: false
}; 