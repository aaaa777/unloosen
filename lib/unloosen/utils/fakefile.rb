require "js"
module Unloosen

    # for debugging
    # run ruby code without vfs build
    class FakeFile

        class << self

            def open(filepath, mode = "r")
                raise NotImprementError, "only read mode supported" if mode != "r"
                fetch_text(filepath)
            end

            def fetch_text(filepath)
                response = JS.global.call(:await, JS.global.call(:fetch, get_url(filepath)))
                response.text.await
            end

            def get_url(filepath)
                JS.global[:chrome][:runtime].call(:getURL, filepath)
            end
        end

        class NotImprementError < StandardError; end
    end
    
end