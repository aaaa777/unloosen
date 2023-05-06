require_relative "./mode"

module Unloosen::Mode
    class Popup < BaseMode
        def should_load?
            ::Unloosen::CURRENT_EVENT != :popup && super
        end
    end
end