require "js"
module Unloosen

    # run ruby code without vfs build
    module FS

        # FS.readI("manifest.json")
        def read(filepath)
            fetch(JS.global.chrome.runtime.getURL(filepath))
        end

        private

        # fetch
        def fetch(url)
            response = JS.global.fetch(url).await
            response.text.await
        end
    

    end
    
end