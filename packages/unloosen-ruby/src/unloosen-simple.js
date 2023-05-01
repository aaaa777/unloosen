import { initRubyVM, evalRubyFileFromExtension, evalRubyCode, evalRubyFileFromURL, printInitMessage } from "./index.js";

await initRubyVM();
printInitMessage();

fetch(chrome.runtime.getURL("unloosen.config.json"))
    .then((response) => response.json())
    .then((json) => {

        // applicationのパスを取得
        return json["application"]
    })
    .then(async (application) => {
        await evalRubyFileFromURL(chrome.runtime.getURL(application));
    });