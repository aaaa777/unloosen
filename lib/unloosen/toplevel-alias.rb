module Unloosen::ToplevelAlias
    def content_script(*args, **kwds, &blk)
        Unloosen::Mode::ContentScript.new(*args, **kwds, &blk)
    end
    
    def background(*args, **kwds, &blk)
        Unloosen::Mode::ContentScript.new(*args, **kwds, &blk)
    end
    
    def sandbox(*args, **kwds, &blk)
        Unloosen::Mode::ContentScript.new(*args, **kwds, &blk)
    end

    def popup(*args, **kwds, &blk)
        Unloosen::Mode::ContentScript.new(*args, **kwds, &blk)
    end

end

@window = JS.global
@document = @window.document
@console = @window.console

class << self
    include Unloosen::ToplevelAlias
    attr_accessor :window, :document, :console
end