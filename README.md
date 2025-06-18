# Twmap - Tailwind Class Mapper

![Twmap Banner](https://i.imgur.com/B8BuqmD.png)

[![GitHub stars](https://img.shields.io/github/stars/cojocaru-david/twmap.svg?style=social)](https://github.com/cojocaru-david/twmap)
[![NPM Version](https://img.shields.io/npm/v/%40cojocarudavid%2Ftwmap)](https://www.npmjs.com/package/@cojocarudavid/twmap)

A CLI tool that scans HTML, JSX, and TSX files to extract Tailwind utility classes and generates optimized CSS mappings with short class names.

## Features

- 🔍 **Smart Parsing**: Analyzes HTML, JSX, and TSX files to find Tailwind class usage
- 🎯 **Consistent Mapping**: Same utility string always generates the same short class name
- 📦 **CSS Generation**: Creates a single CSS file with `@apply` rules
- 🛠️ **Configurable**: Flexible configuration options via config file or CLI
- ⚡ **Fast Processing**: Efficient file scanning and processing
- 🎨 **Multiple Modes**: Hash, incremental, or readable class name generation

## Installation

```bash
npm install -g @cojocarudavid/twmap
```

Or run directly with npx:

```bash
npx twmap
```

## Quick Start

1. **Initialize configuration**:
   ```bash
   twmap --init
   ```

2. **Edit the config file**:
    ```javascript
    // twmap.config.js
    module.exports = {
      input: ['./src/**/*.{tsx,jsx,html}'],
      output: './twmap.css',
      mode: 'hash',
      prefix: 'tw-',
    };
    ```

3. **Run the tool**:
   ```bash
   twmap
   ```

This will:
- Scan files matching the default patterns (`./src/**/*.{tsx,jsx,html}`)
- Generate optimized class names
- Create a `twmap.css` file with mappings
- Update all source files with the new class names

## Configuration

### Config File (`twmap.config.js`)

```javascript
module.exports = {
  // Input file patterns to scan
  input: [
    './src/**/*.{tsx,jsx,html}',
    './components/**/*.{tsx,jsx}',
    './pages/**/*.{tsx,jsx}',
    './app/**/*.{tsx,jsx}',
    './layouts/**/*.{tsx,jsx}',
    './utils/**/*.{tsx,jsx}'
  ],
  
  // Output CSS file path
  output: './twmap.css',
  
  // Class name generation mode
  mode: 'hash', // 'hash' | 'incremental' | 'readable'
  
  // Prefix for generated class names
  prefix: 'tw-',
  
  // Patterns to ignore
  ignore: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.{js,ts,jsx,tsx}'
  ],
  cssCompressor: true,
};
```

### CLI Options

```bash
twmap [options]

Options:
  -c, --config <path>        Path to config file
  -i, --input <patterns...>  Input file patterns
  -o, --output <path>        Output CSS file path
  -m, --mode <mode>          Generation mode (hash|incremental|readable)
  -p, --prefix <prefix>      Prefix for generated class names
  --dry-run                  Preview changes without modifying files (shows what would change)
  --init                     Create a sample config file
  -h, --help                 Display help
```

## How It Works

### Before
```jsx
// Component.tsx
<div className="flex items-center justify-center p-4 bg-blue-500 text-white rounded-lg shadow-md">
  <span className="text-lg font-semibold">Hello World</span>
</div>
```

### After
```jsx
// Component.tsx (updated)
<div className="tw-a1b2c3">
  <span className="tw-d4e5f6">Hello World</span>
</div>
```

```css
/* twmap.css (generated) */
.tw-a1b2c3 {
  @apply flex items-center justify-center p-4 bg-blue-500 text-white rounded-lg shadow-md;
}

.tw-d4e5f6 {
  @apply text-lg font-semibold;
}
```

## Generation Modes

### Hash Mode (`mode: 'hash'`)
Generates short, hash-based class names:
- `tw-a1b2c3`
- `tw-d4e5f6`
- `tw-g7h8i9`

### Incremental Mode (`mode: 'incremental'`)
Generates sequential class names:
- `tw-0`
- `tw-1` 
- `tw-2`

### Readable Mode (`mode: 'readable'`)
Generates somewhat readable class names based on the original classes:
- `tw-flexcenter`
- `tw-textlg`
- `tw-bgblue`

## File Support

- **HTML**: Parses `class` attributes
- **JSX/TSX**: Parses `className` and `class` attributes
- **JavaScript/TypeScript**: Extracts classes from JSX elements

## Integration

### With Build Tools

Add the generated CSS file to your build process:

```javascript
// webpack.config.js
module.exports = {
  entry: './src/index.js',
  // ... other config
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'bundle.css'
    })
  ]
};
```

### With Tailwind CSS

Include the generated file in your Tailwind config:

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  // ... other config
};
```

Then import the generated CSS:

```css
/* In your main CSS file */
@import './twmap.css';
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development
npm run dev

# Test the CLI
npm run dev -- --help
```

## Testing

Twmap uses **Jest** (with Bun) for automated testing. Tests cover parsing, class name generation, CSS generation, and the main processor logic.

To run all tests:

```bash
npm test
# or
bun test
```

Test files are located in the `test/` directory and cover:
- Config loading and validation
- Class name generation (all modes)
- CSS file generation
- File parsing and replacement (HTML, JSX)
- End-to-end processor runs (dry run and real mode)

## Error Tracking & Logging

Twmap integrates with **Sentry** for error and exception tracking. All major steps, warnings, and errors are reported to Sentry for observability. A simple logger utility is used throughout the codebase to:
- Log info, warnings, and errors to the console
- Send logs and breadcrumbs to Sentry

## Performance Improvements

- File parsing and updating are now parallelized for faster processing on large codebases.
- Dry run mode provides a summary of all files that would be changed.

## License

MIT License - see LICENSE file for details.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

To run tests (coming soon):
```bash
npm test
```

## Test Coverage & Future Improvements

- Automated tests for parsing and replacement logic are planned.
- More robust handling for dynamic and template literal class names is on the roadmap.
- Please open issues or PRs for bugs, edge cases, or feature requests!

## File Safety & Backup

- Before running twmap, consider backing up your source files or using version control (e.g., git).
- twmap will overwrite class/className attributes in your files. There is a --dry-run mode to preview changes.
- Dynamic or complex className expressions (e.g., computed values, ternaries, or variables) are skipped and will not be replaced. Review your code and the CLI output for any warnings about skipped replacements.

## Troubleshooting

- **Some classes were not replaced:**
  - Only static class strings and simple template literals are supported. Dynamic expressions are skipped for safety.
  - Check the CLI output for warnings about skipped dynamic classNames.
- **My files were changed unexpectedly:**
  - Use version control or make a backup before running twmap.
  - Use --dry-run to preview changes before applying them.
- **Globs not matching files:**
  - Ensure your input patterns are correct and use forward slashes (/) for cross-platform compatibility.

### Getting Help

- Check the examples in this README
- Run `twmap --help` for CLI options
- Create an issue on GitHub for bugs or feature requests

## CSS Compression (Minification)

You can enable CSS compression/minification for the generated CSS file by adding the following option to your `twmap.config.js`:

```js
module.exports = {
  // ... other options ...
  cssCompressor: true,
};
```

When enabled, the output CSS will be minified using [cssnano](https://cssnano.co/).

## Next.js Compatibility

- `twmap` is compatible with Next.js projects (including Next.js 14+ and Tailwind CSS 4+).
- It scans `.js`, `.jsx`, `.ts`, `.tsx`, and `.html` files by default.
- You can run `twmap` as a build step or manually to generate your optimized CSS file.
- Import the generated CSS file (e.g., `twmap.css`) in your Next.js app, typically in `pages/_app.js` or `app/layout.tsx`:

```js
import '../twmap.css';
```

- You can customize input/output paths and other options in `twmap.config.js`.
