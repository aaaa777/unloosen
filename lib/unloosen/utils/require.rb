module Unloosen; module Utils
    @@load_path = '.:vendor/bundle'

    def extention_local_lib_exists?(lib)
        @@load_path.split(':')
    end

    
end; end


class << self

    # see original source code:
    # https://github.com/mathias234/ruby-front/blob/master/src/main.rb

    def require_remote(file_url)
        file = JS.global.fetch(file_url).await
        code = file.text.await.to_s
    
        Kernel.eval(code, TOPLEVEL_BINDING, file_url)
    end

    def build_extention_url(filename)
        JS.global.chrome.runtime.getUrl(filename)
    end

    # patch
    def require(lib)
        
        if extension_local(lib) then
            return require_extention_local(lib)
        end
        
        if lib == "require_test_library" then
            return "test_lib!"
        end
        
        return super(lib)
    end

    def get_gem_install_path()
        
        build_extention_url("Gemfile.lock")
    end

    def load_from_extension
end