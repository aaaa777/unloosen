import { evalRubyCode, evalRubyFromExtension } from "../unloosen.js";

await evalRubyCode("require 'require'; module Unloosen; CURRENT_EVENT = :content_script; end");
await evalRubyFromExtension("app.rb");
