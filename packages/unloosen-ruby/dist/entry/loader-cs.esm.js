(async() => {
    const loadConfig = async (configKey, defaultVal) => {
        return await fetch(chrome.runtime.getURL("unloosen.config.json"))
            .then((response) => { 
                if(response.ok) {
                    return response.json().then((json) => json[configKey] == undefined ? defaultVal : json[configKey]);
                } else {
                    return defaultVal;
                } 
            });
    };

    // load as module
    // https://blog.holyblue.jp/entry/2022/07/10/182137
    
    const path = await loadConfig("content-script-entry", 'packages/unloosen-ruby/dist/entry/init-cs.esm.js');
    const src = chrome.runtime.getURL(path);
    await import(src);
})();
