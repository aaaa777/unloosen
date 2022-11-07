import { initRubyVM, evalRubyFileFromExtension, evalRubyCode, evalRubyFileFromURL, printInitMessage } from "./index.js";

await initRubyVM();
printInitMessage();

fetch(chrome.runtime.getURL("unloosen.config.json"))
    .then((response) => response.json())
    .then((json) => {
        evalRubyFileFromExtension(json["service_worker"]);
    });