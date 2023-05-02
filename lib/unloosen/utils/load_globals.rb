#require "erb"

class << self

    # add popup controller
    def popup(uri_pattern, &blk)
        controller = ::Unloosen::PopupController.new
        controller.hook_proc(uri_pattern, &blk)
    end

    def erb(sym_filename)
        file = Unloosen::Utils.get_content("views/" + sym_filename.to_s)
        ERB.new(file).run
    end

    def run
        event = EventContainer.new
        Unloosen::Controller.emit_event()
    end

    
    def document; JS.global; end
    def console; JS.global[:console]; end
    def fetch(args**); JS.global.fetch(args); end
    #p JS.global[:Object][:keys].call(:call, JS.global, (JS.global[:window])).inspect.split(",")
end