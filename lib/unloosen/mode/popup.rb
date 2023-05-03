require_relative "./mode"

module Unloosen::Mode
    class Popup < BaseMode
        def initialize(**kwds, &blk)
            return if ::Unloosen::CURRENT_EVENT != :popup

            super(**kwds, &blk)            
        end
    end
end