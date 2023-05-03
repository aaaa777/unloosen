require_relative "./mode"

module Unloosen::Mode
    class Sandbox < BaseMode
        def initialize(**kwds, &blk)
            return if ::Unloosen::CURRENT_EVENT != :sandbox

            super(**kwds, &blk)            
        end
    end
end