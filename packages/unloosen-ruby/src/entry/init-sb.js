import { buildExtensionURL, evalRubyCode, evalRubyFromExtension, loadConfig } from "../unloosen.js";

const main = async () => {
    await evalRubyCode("module Unloosen; CURRENT_EVENT = :sandbox; end");
    
    if(await loadConfig("remote-require", true)) {
        await evalRubyCode("require 'require_remote'");
        console.log(await loadConfig("remote-require", true));
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('lib') +"')");
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('') +"')");
    }
    await evalRubyCode("require('" + await loadConfig("application", 'app.rb') + "')")
}

await main();