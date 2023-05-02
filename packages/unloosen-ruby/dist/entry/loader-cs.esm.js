// load as module
// https://blog.holyblue.jp/entry/2022/07/10/182137
(async() => {
    // const src = chrome.runtime.getURL("packages/unloosen-ruby/src/content-script.js");
    const src = chrome.runtime.getURL("packages/unloosen-ruby/dist/entry/init-cs.esm.js");
    await import(src);
})();
