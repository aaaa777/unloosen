module Unloosen; module Mode
    class BaseMode
        def initialize(enable_all_site: false, site: nil, sites: [])
            return if ::Unloosen::CURRENT_EVENT != :content_script

            page_url = JS.global.location.href.inspect[1...-1]

            return yield(JS.global) if match_sites(sites, page_url) || site == page_url || enable_all_site

            
            
        end
        
        def match_sites(sites, page_url)
            sites.find do |site|
                site.match?(page_url)
            end    
        end
    end
end; end