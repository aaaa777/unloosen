module Unloosen; module RequirePatch
    # @base_uri = nil
    # @pwd_uri = nil
    # @loaded_uri = []

    class << self
        attr_accessor :base_uri, :file_pwd, :loaded_uri
    end

    def require_remote_lib(lib, base_uri)
        @loaded_uri = []
        p "require_remote_lib WIP"
        last_base_uri, last_pwd_uri = @base_uri, @pwd_uri

        @base_uri = ::URI.parse(base_uri.chomp('/') + '/')
        @pwd_uri = @base_uri
        require lib
        @base_uri = last_base_uri
    end


    # override require
    def require(lib)
        
        return super lib unless @base_uri
        return false if @loaded_uri.include?((@base_uri + lib).to_s)

        # save curretn uri
        last_base_uri, last_pwd_uri = @base_uri, @pwd_uri

        if lib == "require_test_library"  || lib == 'js' then
            return "test_lib!"
        end
        
        # 
        src = fetch_remote_text(@base_uri + lib)
        if src then
            @pwd_uri += lib
            eval(src)
            @loaded_uri << (last_base_uri + lib).to_s
            @base_uri, @pwd_uri = last_base_uri, last_pwd_uri
            return true
        end
        p src_uri
        
        super lib
    end

    def require_relative(lib)
        p "relative called"

        return false if @loaded_uri.include?((@pwd_uri + lib).to_s)

        last_base_uri, last_pwd_uri = @base_uri, @pwd_uri

        # fetch pwd file
        src = fetch_remote_text(@pwd_uri + lib)
        if src then
            @pwd_uri += lib
            eval(src)
            @loaded_uri << (last_pwd_uri + lib).to_s
            @base_uri, @pwd_uri = last_base_uri, last_pwd_uri
            return true
        end

        
        p "joined"
        super lib
    end

    # fetch_remote
    def fetch_remote_text(uri, suffix: nil, set_suffix: true)
        p "fetch_remote called #{uri}"
        uri_str = uri.to_s
        uri_str += suffix if suffix

        return fetch_remote_text(uri, suffix: ".rb") || fetch_remote_text(uri, suffix: ".so") if set_suffix && !(/[.](rb|so)$/.match uri_str)
        
        p "requesting... #{uri_str}"
        res = JS.global.call(:fetch, uri_str).await
        res.text.await.to_s
    end
end; end

module Kernel
    prepend Unloosen::RequirePatch
end