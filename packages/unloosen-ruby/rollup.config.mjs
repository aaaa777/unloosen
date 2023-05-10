import { nodeResolve } from "@rollup/plugin-node-resolve";
import inject from "@rollup/plugin-inject";
import nodePolyfills from "rollup-plugin-polyfill-node";

function variant(basename) {
    return {
        input: `src/${basename}.js`,
        output: [
            {
                file: `dist/${basename}.esm.js`,
                format: "es",
                name: "unloosen-ruby",
            }
        ],
        plugins: [
            nodePolyfills(),
            inject({ Buffer: ['buffer', 'Buffer']}),
            nodeResolve(),
        ],
        external: [
            'wasmer_wasi_js_bg.wasm',
        ],
    };
  }

export default [
    variant('index'),
    variant('unloosen'),    
    variant('entry/module-background'),
    variant('entry/module-content-script'),
    variant('entry/module-popup'),
    variant('entry/module-sandbox'),
    variant('entry/loader-content-script'),
];