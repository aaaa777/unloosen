import { buildExtensionURL, evalRubyCode, evalRubyFromExtension, loadConfig, init } from "../unloosen.js";

const main = async () => {
    await init();
    await evalRubyCode("module Unloosen; CURRENT_EVENT = :background; end");
    
    if(await loadConfig("remote-require", true)) {
        await evalRubyCode("require 'require_remote'");
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('lib') +"')");
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('') +"')");
    }
    
    chrome.runtime.onInstalled.addListener(async () => {
        await evalRubyCode("module Unloosen; ON_INSTALLED = true; end");
    });

    await evalRubyFromExtension(await loadConfig("application", 'app.rb'));
}

main();