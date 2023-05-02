// import { DefaultRubyVM } from "ruby-head-wasm-wasi/dist/browser.esm.js";
import { DefaultRubyVM } from "../../node_modules/ruby-3_2-wasm-wasi/dist/browser.esm.js";

export const buildExtensionURL = (filepath) => {
    return new URL(chrome.runtime.getURL(filepath));
}

export const initRubyVM = async () => {
    const response = await fetch(buildExtensionURL("ruby-packed.wasm"));
    // const response = await fetch("chrome-extension://njglhiklhjidblokkdjammkclhpbcflc/ruby.wasm");
    const buffer = await response.arrayBuffer();
    const module = await WebAssembly.compile(buffer);
    const { vm } = await DefaultRubyVM(module);

    return vm;
};
