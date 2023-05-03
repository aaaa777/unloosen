module Unloosen; module Debugger
    def breakpoint
        
    end
end

module Kernel
    prepend Unloosen::Debugger
end