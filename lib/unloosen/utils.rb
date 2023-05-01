require_relative 'utils/js_wrapper'
require_relative 'utils/load_global'

module Unloosen::Utils
    def is_popup?
        true
    end

    def is_background?
        true
    end

    def is_content_script?
        true
    end

    def get_url_from_filepath(filepath)
        JS.global.chrome.runtime.getURL(filepath)
    end

    def fetch_file(filepath)
        fetch(fetch_file(filepath))
    end

    def fetch(uri)
        JS.global.fetch(uri).await.text.await
    end

    def get_request(url)
        # 危険
        JS.eval("return await fetch(\"#{url}\");")
    end

    def get_content(filepath)
        get_request(get_url(filepath))
    end
end