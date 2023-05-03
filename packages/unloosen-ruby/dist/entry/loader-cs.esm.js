const loadConfig = async (configKey, defaultVal) => {
    return await fetch(chrome.runtime.getURL("unloosen.config.json"))
        .then((response) => { 
            if(response.ok) {
                const json = response.json();
                return json[configKey] || defaultVal;
            } else {
                return defaultVal;
            } 
        });
};

// load as module
// https://blog.holyblue.jp/entry/2022/07/10/182137
(async() => {
    const path = await loadConfig("content-script-entry", 'package/unloosen-ruby/dist/entry/init-cs.esm.js');
    const src = chrome.runtime.getURL(path);
    await import(src);
})();
