
# p JS.global[:chrome][:runtime].call(:getURL, "manifest.json")
require "unloosen"
# simple unloosen version like sinatro
#require_relative "lib/unloosen_simple"

# when popup message
#popup do
    # popup last value
    "テストメッセージ"
#end
p "app loaded"
JS.global.console.log("load test")
# when load site
content_script sites: ["http://www.example.com/", /^*.google.com$/] do |g|
    p("hello, world!")
    p window
    p document
    p console.log("hello, world2!")
end



