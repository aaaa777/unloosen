require_relative "./mode"

module Unloosen::Mode
    class Background < BaseMode
        def should_load?
            ::Unloosen::CURRENT_EVENT != :background && super
        end
    end
end