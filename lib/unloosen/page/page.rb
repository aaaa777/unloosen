module Unloosen
    class Page
        def initialize(uri_pattern: uri_pattern, proc: blk)
            @uri_pattern = uri_pattern
            @proc = blk
        end

        def load(event_container)
            @blk.(event_container)
        end
    end
end