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
    variant('entry/init-bg'),
    variant('entry/init-cs'),
    variant('entry/init-pu'),
    variant('entry/init-sb'),
    variant('entry/loader-bg'),
    variant('entry/loader-cs'),
    variant('entry/loader-pu'),
    variant('entry/loader-sb'),
];