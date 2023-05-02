module Unloosen; module Event
    module Observer
        class << self
            @@events = []

            def add_listener(type, listener)
                type = type.to_s

                @@event[type] = [] unless @@events[type]
                @@event[type] = listener
            end

            def add_event_hook(type, &block)
                
            end
        end
        
    end
end; end