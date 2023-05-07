importScripts('/packages/unloosen-ruby/dist/entry/init-bg.esm.js');

(async() => {

    // load as module
    // https://blog.holyblue.jp/entry/2022/07/10/182137

    // const path = await loadConfig("background-entry", 'packages/unloosen-ruby/dist/entry/init-bg.esm.js')
    // const src = chrome.runtime.getURL(path);
    // await import(src);
})();
main();

// note: remove `Element` from dist/init-bg because Element not defined in Background
// Element.prototype._addEventListener = Element.prototype.addEventListener;
