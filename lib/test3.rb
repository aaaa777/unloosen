$:.unshift "/unloosen"
p require "js"
# p require 'unloosen/utils/js'
p JS.global.call(:fetch, "/").await.text.await
require 'csv'
require 'uri'

module RequirePatch
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

    def require(lib)
            
        #if extension_local(lib) then
        #    return require_extention_local(lib)
        #end

        # last_pwd_uri = nil
        # last_pwd_uri, @pwd_uri = @pwd_uri, '.' if @base_uri

        p "require called"
        return false unless @base_uri
        return false if @loaded_uri.include?((@base_uri + lib).to_s)

        last_base_uri, last_pwd_uri = @base_uri, @pwd_uri

        if lib == "require_test_library"  || lib == 'js' then
            return "test_lib!"
        end
        
        p @base_uri
        src = find_remote_lib(@base_uri + lib)
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
        src = find_remote_lib(@pwd_uri + lib)
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

    def find_remote_lib(uri, suffix: nil)
        p "find_remote called #{uri}"
        uri_str = uri.to_s
        uri_str += suffix if suffix
        p uri_str

        ext = /[.](rb|so)/.match uri_str
        return find_remote_lib(uri, suffix: ".rb") || find_remote_lib(uri, suffix: ".so") unless ext
        
        p "requesting... #{uri_str}"
        res = JS.global.call(:fetch, uri_str).await
        p res
        text = res.text.await.to_s
        text
    end
end

module Kernel
    prepend RequirePatch
end

{
    "3.2.0rc1": "3.2.0+3"
}
p Object::RUBY_VERSION
p __FILE__
p Dir.pwd
require "js"
require_remote_lib("test", "chrome-extension://njglhiklhjidblokkdjammkclhpbcflc/lib")