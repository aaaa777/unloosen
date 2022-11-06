const path = require('path');

module.exports = {
  // モードの設定
  mode: 'development',

  // エントリーポイントの設定
  entry: {
    index: "./src/index.js",
    "service-worker": "./src/service-worker.js",
    "content-script": "./src/content-script.js",
    "init-ruby": "./src/init-ruby.js"
  },

  experiments: {
    topLevelAwait: true
  },

  // ファイルの出力設定
  output: {
    // 出力するファイル名
    filename: "[name].umd.js",
    library: 'unloosenRubyLoader',
    libraryTarget: 'umd',
    //  出力先のパス
    path: path.join(__dirname, 'dist')
  }

};