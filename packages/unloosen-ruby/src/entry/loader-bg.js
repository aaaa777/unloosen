// load as module
// https://blog.holyblue.jp/entry/2022/07/10/182137
(async() => {
    await fetch(chrome.runtime.getURL("unloosen.config.json"))
        .then((response) => response.json())
        .then((json) => {
            return json["background-entry-remote"] || json["background-entry"] || "packages/unloosen-ruby/dist/init-bg.esm.js";
        })
        .then(async (path) => {
            const src = chrome.runtime.getURL(path);
            await import(src);
        });
    // const src = chrome.runtime.getURL("packages/unloosen-ruby/src/content-script.js");
    // const src = chrome.runtime.getURL("packages/unloosen-ruby/dist/unloosen.js");
})();

