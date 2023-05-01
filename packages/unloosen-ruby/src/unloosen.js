import { initRubyVM, buildExtensionURL } from "./index.js";

export const UnloosenVersion = "0.0.2";
export const printInitMessage = () => {
    evalRubyCode(`
    puts <<~"INF"
        Unloosen Ruby Browser Extension by logiteca7/aaaa777
        Ruby version: #{RUBY_DESCRIPTION}
        Unloosen version: ${UnloosenVersion}
    INF
`);
};

const initUnloosenFS = () => {
    evalRubyCode(`require"js";module Unloosen;class File;class << self;def read(filepath);fetch(JS.global.chrome.runtime.getURL(filepath));end;private;def fetch(url);JS.global.fetch(url).await.text.await;end;end;end;end`);
}

export const UnloosenRubyVM = await initRubyVM();

// eval ruby script
export const evalRubyFileFromURL = async (url) => {
    await fetch(url)
        .then((response) => response.text())
        .then((text) => evalRubyCode(text));
};

// build chrome-extension:// url and eval ruby script
export const evalRubyFileFromExtension = async (filepath) => {
    await evalRubyFileFromURL(buildExtensionURL(filepath));
}

export const evalRubyCode = async (code) => {
    UnloosenRubyVM.evalAsync(code);
}