const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const mode = process.env.NODE_ENV || 'development'; // Automatically set mode based on env
const target = "electron-renderer"; // Target Electron renderer process
const output = path.resolve(__dirname, 'dist'); // Output directory
const bundle = 'js/lilypad.compiled.js'; // Output directory

// Simple and clean console log
console.log('\n==============================');
console.log('🚀 Webpack compilation config');
console.log('📦 Mode       :', mode.toUpperCase());
console.log('📁 Target     :', target);
console.log('📁 Bundle     :', bundle);
console.log('==============================\n');

module.exports = {
  mode,
  entry: './src/renderer/renderer.js',
  target: target,
  output: {
    filename: bundle,
    path: output,
    assetModuleFilename: 'assets/[ext]/[name][ext]',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Transpile JS
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/, // Load CSS
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(mp3|wav|ogg|webm|mp4|opus|m4a|aac)$/, // Media files
        type: 'asset/resource',
        generator: {
          filename: 'assets/media/[name][ext]'
        }
      },
      {
        test: /\.json$/, // JSON files
        type: 'asset/resource',
        generator: {
          filename: 'assets/json/[name][ext]'
        }
      },
      {
        test: /\.(webp|png|jpg|jpeg|gif|svg|ico)$/, // Image files
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/, // Font files
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html'
    })
  ]
};
