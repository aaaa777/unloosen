const path = require('path');

module.exports = {
  // モードの設定
  mode: 'development',

  // エントリーポイントの設定
  entry: `./src/index.js`,

  experiments: {
    topLevelAwait: true
  },

  // ファイルの出力設定
  output: {
    // 出力するファイル名
    filename: "index.umd.js",
    library: 'unloosenRubyLoader',
    libraryTarget: 'umd',
    //  出力先のパス
    path: path.join(__dirname, 'dist')
  }

};