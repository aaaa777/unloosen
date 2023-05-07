require 'uri'
require 'js'

module Unloosen; module RequirePatch
    # @base_uri = nil
    # @pwd_uri = nil

    # class << self
    #     attr_accessor :base_uri, :file_pwd, :loaded_uri
    # end

    def add_require_remote_uri(base_uri)
        @base_uris ||= []
        @loaded_uris ||= []
        @failed_uris ||= []
        @base_uris << ::URI.parse(base_uri.chomp('/') + '/')
        p "add_require_remote_uri WIP"
        # last_base_uri, last_pwd_uri = @base_uri, @pwd_uri

        # @base_uri = ::URI.parse(base_uri.chomp('/') + '/')
        # @pwd_uri = @base_uri
        # require lib
        # @base_uri = last_base_uri
    end


    # override require
    def require(lib)
        
        p 'require called'
        p lib
        # p @pwd_uri

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

            p "searching #{lib_uri}"
 
            # catch 404
            begin
                src = fetch_remote_text(lib_uri)
            rescue => exception
                puts exception
                
                next false
            end

            next unless src
            
            # set pwd_uri
            @pwd_uri = lib_uri
            p "pwd_uri is now `#{@pwd_uri}`"
            
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

        p "relative called"

        return super lib unless @pwd_uri
        
        # what a...
        if lib == "require_test_library" then
            return "test_lib!"
        end
        
        #return super lib if @base_uris.empty?

        # save curretn uri
        last_pwd_uri = @pwd_uri

        lib_uri = @pwd_uri + lib
        return false if @loaded_uris&.include?(lib_uri.to_s)

        # catch 404
        begin
            src = fetch_remote_text(lib_uri)
        rescue  => exception
            puts exception
            # when libs not found in remote
            return super lib
        end
        
        # set pwd_uri
        @pwd_uri += lib
        p "pwd_uri is now `#{@pwd_uri}`"
        
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
        p "fetch_remote called #{uri_str}"

        return fetch_remote_text(uri, complete_suffix: false) || fetch_remote_text(uri, suffix: ".rb", complete_suffix: false) || fetch_remote_text(uri, suffix: ".so", complete_suffix: false) if complete_suffix && !(/[.](rb|so)$/.match uri_str)
        #sleep(1)
        p "requesting... #{uri_str}"

        return nil if @failed_uris.include?(uri_str)

        res = JS.global.fetch(uri_str).await
        p res
        if !res || !(res[:ok]) then
            @failed_uris << uri_str
            return
        end
        text = res.text.await.to_s
        p text
        text
    end
end; end

module Kernel
    prepend Unloosen::RequirePatch
end