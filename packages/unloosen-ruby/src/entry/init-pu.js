import { evalRubyCode, evalRubyFromExtension } from "../unloosen.js";

evalRubyCode("require 'require'; module Unloosen; CURRENT_EVENT = :popup; end");
evalRubyFromExtension("app.rb");
