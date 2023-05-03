import { initVM } from "./index.js";

export const UnloosenVersion = "0.0.2";
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
export const evalRubyCode = async (code) => {
    await Unloosen.evalAsync(code);
}

export const evalRubyFromURL = async (url) => {
    await fetch(url)
        .then((response) => response.text())
        .then((text) => evalRubyCode(text));
};

// build chrome-extension:// url and eval ruby script
export const evalRubyFromExtension = async (filepath) => {
    await evalRubyFromURL(buildExtensionURL(filepath));
}

export const loadConfig = async (configKey, defaultVal) => {
    return await fetch(chrome.runtime.getURL("unloosen.config.json"))
        .then((response) => { 
            if(response.ok) {
                return response.json().then((json) => json[configKey] || defaultVal);
            } else {
                return defaultVal;
            } 
        });
}

const main = async () => {
    printInitMessage();
}

export const Unloosen = await initVM(buildExtensionURL(await loadConfig("ruby.wasm", "ruby.wasm")));

await main();