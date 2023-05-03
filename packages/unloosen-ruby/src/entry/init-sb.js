import { evalRubyCode, evalRubyFromExtension } from "../unloosen.js";

await evalRubyCode("require 'require_remote'; module Unloosen; CURRENT_EVENT = :sandbox; end");
await evalRubyFromExtension("app.rb");
