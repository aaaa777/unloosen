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

    def alert(message)
        JS.global.alert(message)
    end

    def fetch(url)
        JS.global.fetch(url)
    end
end

@window = JS.global
@undefined = JS::Undefined
@null = JS::Null
# overwrite eql? method to be comparable JS object
@document = @window.document if @window[:document] != @undefined
@console = @window.console if @window[:console] != @undefined
@chrome = @window.chrome if @window[:console] != @undefined

class << self
    include Unloosen::ToplevelAlias
    attr_accessor :window, :document, :console
    attr_accessor :chrome
    attr_reader :undefined, :null
end