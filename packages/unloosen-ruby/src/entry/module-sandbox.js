import { buildExtensionURL, evalRubyCode, evalRubyFromExtension, loadConfig, init } from "../unloosen.js";

const main = async () => {
    await init();
    await evalRubyCode("module Unloosen; CURRENT_EVENT = :sandbox; end");
    
    await evalRubyCode("require 'require_remote'");
    if(await loadConfig("remote-require", true)) {
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('lib') +"')");
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('') +"')");
    }
    await evalRubyCode(buildExtensionURL(await loadConfig("application", 'app.rb')));
}

main();