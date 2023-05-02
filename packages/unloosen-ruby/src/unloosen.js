import { initVM } from "./index.js";

export const Unloosen = await initVM(buildExtensionURL("ruby-packed.wasm"));

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
    Unloosen.evalAsync(code);
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

const main = async () => {
    printInitMessage();
}

await main();