import { buildExtensionURL, evalRubyCode, evalRubyCodeAsync, evalRubyFromExtension, loadConfig, init } from "../unloosen.js";

var initAwait;

const main = async () => {
    initAwait = init();
    await initAwait;
    evalRubyCode("module Unloosen; CURRENT_EVENT = :background; end");
    
    evalRubyCode("require 'require_remote'");
    if(await loadConfig("remote-require", true)) {
        evalRubyCode("add_require_remote_uri('" + buildExtensionURL('lib') +"')");
        evalRubyCode("add_require_remote_uri('" + buildExtensionURL('') +"')");
    }
 
    await evalRubyFromExtension(await loadConfig("application", 'app.rb'));
}


const onInstalled = async () => {
    while(initAwait == undefined) ;
    await initAwait;
    evalRubyCode("module Unloosen; ON_INSTALLED = true; end");
}

chrome.runtime.onInstalled.addListener(onInstalled);
main();