module Unloosen; module LoadType
    class ContentScript
        def init(sites: sites)
            
            if ::Unloosen::CURRENT_EVENT == :content_script
                then
                yield(JS.global)
            end
        end
    end
end; end