import { initVM } from "./index.js";

var VM;
var awaitVM;

export const UnloosenVersion = "0.1.0";
const printInitMessage = () => {
    evalRubyCode(`
    puts <<~"INF"
        Unloosen Ruby Browser Extension by logiteca7/aaaa777
        Ruby version: #{RUBY_DESCRIPTION}
        Unloosen version: ${UnloosenVersion}
    INF
    `);
};

export const buildExtensionURL = (filepath) => {
    return new URL(chrome.runtime.getURL(filepath));
}

// eval ruby script
export const evalRubyCode = (code) => {
    VM.eval(code);
}

export const evalRubyCodeAsync = async (code) => {
    await VM.evalAsync(code);
}

export const evalRubyFromURL = async (url) => {
    await fetch(url)
        .then((response) => response.text())
        .then((text) => evalRubyCodeAsync(text));
};

// build chrome-extension:// url and eval ruby script
export const evalRubyFromExtension = async (filepath) => {
    await evalRubyFromURL(buildExtensionURL(filepath));
}

export const loadConfig = async (configKey, defaultVal) => {
    return await fetch(chrome.runtime.getURL("unloosen.config.json"))
        .then((response) => { 
            if(response.ok) {
                return response.json().then((json) => json[configKey] == undefined ? defaultVal : json[configKey]);
            } else {
                return defaultVal;
            } 
        });
}

export const init = async () => {
    return initVM(buildExtensionURL(await loadConfig("ruby.wasm", "ruby.wasm")))
        .then(async (vm) => {
            VM = vm;
            return evalRubyCode('$:.unshift "/unloosen"');
        })
        .then(async () => printInitMessage());
}