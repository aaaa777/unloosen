require_relative "./mode"

module Unloosen::Mode
    class Background < BaseMode
        def initialize(**kwds, &blk)
            return if ::Unloosen::CURRENT_EVENT != :background

            super(**kwds, &blk)            
        end
    end
end