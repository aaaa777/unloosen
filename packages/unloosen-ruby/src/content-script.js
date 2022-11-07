import { initRubyVM, evalRubyFileFromExtension, evalRubyCode, evalRubyFileFromURL, printInitMessage } from "./index.js";

await initRubyVM();
printInitMessage();

fetch(chrome.runtime.getURL("unloosen.config.json"))
    .then((response) => response.json())
    .then((json) => {

        // URLとマッチしたスクリプトを返す
        return json["content_scripts"].filter((rule) => {

            // とりあえずall_urlsのみ
            return rule.matches.filter((match) => {
                return match === "<all_urls>"
            }).length;

        })
    })
    .then((content_script) => {
        content_script.map((rule) => {
            rule.rb.map(async (ruby_script) => {
                await evalRubyFileFromURL(chrome.runtime.getURL(ruby_script));
            })
        });
    });