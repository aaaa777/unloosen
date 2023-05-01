module JS

    def window
        {}
    end

    def global
        {}
    end
    
    def console
        {}
    end

    def eval(script)
        ""
    end

    def is_native?()
        true
    end

    module_function :global, :window, :console, :eval, :is_native?

    class Object

        
    end
end
