require_relative "./mode"

module Unloosen::Mode
    class ContentScript < BaseMode
        def initialize(enable_all_site: false, site: nil, sites: [], **kwds, &blk)
            @enable_all_site = enable_all_site
            @site = site
            @sites = sites
            @page_url = JS.global.location.href.inspect[1...-1]

            super(**kwds, &blk)            
        end

        def should_load?
            ::Unloosen::CURRENT_EVENT == :content_script && super || @sites.find { |s| s.match?(@page_url) } || @site == @page_url || @enable_all_site
        end
    end
end