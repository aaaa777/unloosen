#require_relative "page"
require_relative "./event/event_container"

module Unloosen


    # route key format
    # ex: content_script://
    class BaseController

        @@controllers = []

        def initialize
            @@controllers += self
            @pages = []
            @routing_type = nil
        end

        def hook_proc(uri_pattern, &blk)
            page = ::Unloosen::Page.new(uri_pattern: uri_pattern, proc: blk)
            hook_page(page)
        end

        def hook_script_url(uri_pattern, script_url_src)
            blk = Proc.new { eval(::Unloosen::Utils.fetch_file(script_url_src)) }
            page = ::Unloosen::Page.new(uri_pattern: uri_pattern, proc: blk)
            hook_page(page)
        end

        def hook_page(page)
            @pages += page
        end

        #  popup    content_script
        #  |        |
        #  v        v
        # +----------+
        # |Controller| matching
        # +----------+
        #  |
        #  v
        # +--------------+
        # |  Page array  | invoke
        # +--------------+
        #  |     |     |
        #  v     v     v
        #  r1.rb r2.rb r3.rb

        def event(event_container)
            @pages.each do |page|
                return if self.routing_type && event_container.routing_type != self.routing_type
                
                page.load(event_container)
            end
        end

        

        class < self
            def emit_event(event)
                @@controllers.each do |controller|
                    controller.event(event)
                end
            end
        end
    end

    class 
        def initialize
            
        end
    end

    module Path
        def match(path1, path2)
            
        end
    end

    class ContentScriptController << BaseController
        @routing_type = :content_script
    end

    class PopupController << BaseController
        @routing_type = :popup
    end

    class BackgroundController << BaseController
        @routeing_type = :background
        
    end
end