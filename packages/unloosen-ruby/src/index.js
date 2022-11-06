import { DefaultRubyVM } from "ruby-head-wasm-wasi/dist/browser.umd.js";
export var UnloosenRubyVM;

export const UnloosenVersion = "0.0.2";
export const printInitMessage = () => {
    evalRubyCode(`
    puts <<-"INF"
Unloosen Ruby Browser Extension by logiteca7/aaaa777
Ruby version: #{RUBY_DESCRIPTION}
Unloosen version: ${UnloosenVersion}
    INF
`);
};

const buildExtensionURL = (filepath) => {
    return new URL(chrome.runtime.getURL(filepath));
}

export const initRubyVM = async () => {
    const response = await fetch(buildExtensionURL("ruby.wasm"));
    const buffer = await response.arrayBuffer();
    const module = await WebAssembly.compile(buffer);
    const { vm } = await DefaultRubyVM(module);

    UnloosenRubyVM = vm;
};

// eval ruby script
export const evalRubyFileFromURL = async (url) => {
    await fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Chrome Extension fetch error! Status: ${response.status}`);
            }
            return response;
        })
        .then((response) => response.text())
        .then((text) => {
            UnloosenRubyVM.eval(text);
        });

};

// build chrome-extension:// url and eval ruby script
export const evalRubyFileFromExtension = async (filepath) => {
    await evalRubyFileFromURL(buildExtensionURL(filepath));
}

export const evalRubyCode = async (code) => {
    UnloosenRubyVM.eval(code);
}