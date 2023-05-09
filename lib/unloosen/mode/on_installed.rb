require_relative "./mode"

# should be event?
module Unloosen::Mode
    class OnInstalled < BaseMode
        def should_load?
            ::Unloosen.const_defined?("ON_INSTALLED") && super
        end
    end
end