import { evalRubyCode, evalRubyFromExtension } from "../unloosen.js";

await evalRubyCode("require 'require'; module Unloosen; CURRENT_EVENT = :background; end");
await evalRubyFromExtension("app.rb");
