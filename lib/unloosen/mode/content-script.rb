require_relative "./mode"

module Unloosen::Mode
    class ContentScript < BaseMode
        def initialize(**kwds, &blk)
            return if ::Unloosen::CURRENT_EVENT != :content_script

            super(**kwds, &blk)            
        end
    end
end