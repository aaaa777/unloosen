// load as module
// https://blog.holyblue.jp/entry/2022/07/10/182137
(async() => {
    // const src = chrome.runtime.getURL("packages/unloosen-ruby/src/content-script.js");
    const src = chrome.runtime.getURL("packages/unloosen-ruby/src/unloosen2.js");
    await import(src);
})();

