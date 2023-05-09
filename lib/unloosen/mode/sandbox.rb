require_relative "./mode"

module Unloosen::Mode
    class Sandbox < BaseMode
        def should_load?
            ::Unloosen::CURRENT_EVENT == :sandbox && super
        end
    end
end