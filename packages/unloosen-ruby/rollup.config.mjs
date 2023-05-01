import { nodeResolve } from "@rollup/plugin-node-resolve";
import inject from "@rollup/plugin-inject";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default {
	input: 'src/index2.js',
	output: {
        //dir: 'dist',
		file: 'index2.js',
		format: 'es'
	},
    plugins: [
        nodePolyfills(),
        inject({ Buffer: ['buffer', 'Buffer']}),
        nodeResolve(),
    ],
    external: [
        'ruby-packed.wasm',
        //'ruby.wasm',
        'wasmer_wasi_js_bg.wasm',
    ]
};