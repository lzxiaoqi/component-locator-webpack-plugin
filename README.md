# Component Locator Webpack Plugin

A Webpack plugin that allows you to quickly locate and open Vue components in your preferred editor by Ctrl/Cmd + clicking on elements in the browser.

## Installation

```bash
npm install component-locator-webpack-plugin --save-dev
```

## Usage

In your Webpack configuration file:

```javascript
const ComponentLocatorPlugin = require('component-locator-webpack-plugin');

module.exports = {
  // ... other webpack config
  plugins: [
    new ComponentLocatorPlugin({
      // options
    })
  ]
};
```

## Options

- `editor`: The editor to open files in. Can be 'vscode', 'webstorm', or 'idea'. Default: 'vscode'
- `componentExtensions`: File extensions to consider as components. Default: ['.vue', '.js', '.ts', '.jsx', '.tsx']
- `triggerKey`: The key to hold while clicking. Can be 'ctrl', 'cmd', or 'both'. Default: 'both'
- `srcDir`: The source directory of your components. Default: 'src'
- `forceEnable`: Force enable the plugin in production mode. Default: false

## License

MIT