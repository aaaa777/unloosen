require 'uri'
require 'js'

class << self

    def add_require_remote_uri(base_uri)
        @base_uris ||= []
        @loaded_uris ||= []
        @failed_uris ||= []
        @base_uris << ::URI.parse(base_uri.chomp('/') + '/')
    end


    # override require
    def require(lib)

        # patch
        return false if lib == 'js'

        # what a...
        if lib == "require_test_library" then
            return "test_lib!"
        end
        
        # when @base_uris not set or empty
        return super lib if @base_uris&.empty?

        # save curretn uri
        last_pwd_uri = @pwd_uri

        return true if @base_uris&.find do |base_uri|
            lib_uri = base_uri + lib
            return false if @loaded_uris.include?(lib_uri.to_s)
 
            src = fetch_remote_text(lib_uri)

            next false unless src
            
            # set pwd_uri
            @pwd_uri = lib_uri
            
            # eval lib src
            Kernel.eval(
                src,
                TOPLEVEL_BINDING,
                lib_uri.to_s
            )

            # mem loaded lib
            @loaded_uris << lib_uri.to_s

            # set this pwd_uri scope
            @pwd_uri = last_pwd_uri
            true
        end
        
        # when libs not found in remote
        super lib
    end

    def require_relative(lib)

        relative_from = caller_locations(1..1).first
        relative_from_path = relative_from.absolute_path || relative_from.path
        absolute_lib = File.expand_path("../#{lib}", relative_from_path)

        return self.require absolute_lib unless @pwd_uri
        
        # what a...
        if lib == "require_test_library" then
            return "test_lib!"
        end
        
        #return super lib if @base_uris.empty?

        # save curretn uri
        last_pwd_uri = @pwd_uri

        lib_uri = @pwd_uri + lib
        return false if @loaded_uris&.include?(lib_uri.to_s)

        src = fetch_remote_text(lib_uri)

        # when libs not found in remote
        return self.require absolute_lib unless src
        
        # set pwd_uri
        @pwd_uri += lib
        
        # eval lib src
        Kernel.eval(
            src,
            TOPLEVEL_BINDING,
            lib_uri.to_s
        )

        # mem loaded lib
        @loaded_uris << lib_uri.to_s

        # set this pwd_uri scope
        @pwd_uri = last_pwd_uri
        true
    end

    # fetch_remote
    def fetch_remote_text(uri, suffix: nil, complete_suffix: true)
        uri_str = uri.to_s
        uri_str += suffix if suffix

        return fetch_remote_text(uri, complete_suffix: false) || fetch_remote_text(uri, suffix: ".rb", complete_suffix: false) || fetch_remote_text(uri, suffix: ".so", complete_suffix: false) if complete_suffix && !(/[.](rb|so)$/.match uri_str)

        return nil if @failed_uris.include?(uri_str)

        begin
            res = JS.global.fetch(uri_str).await
        rescue => exception
            res = nil
        end

        if !res || !(res[:ok]) then
            @failed_uris << uri_str
            return nil
        end
        res.text.await.to_s
    end
end