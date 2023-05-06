module Unloosen; module Mode
    class BaseMode
        def initialize(enable: true)
            @enable = enable

            return yield(JS.global) if self.should_load?
        end
                
        def should_load?
            @enable
        end
    end
end; end