import { evalRubyCode, evalRubyFromExtension } from "../unloosen.js";

evalRubyCode("require 'require'; module Unloosen; CURRENT_EVENT = :sandbox; end");
evalRubyFromExtension("app.rb");
