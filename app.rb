
# p JS.global[:chrome][:runtime].call(:getURL, "manifest.json")
require "unloosen"
# simple unloosen version like sinatro
#require_relative "lib/unloosen_simple"

# when popup message
#popup do
    # popup last value
    "テストメッセージ"
#end

# when load site
Unloosen::LoadType::ContentScript sites: ["example.com", /^*.google.com$/] do
    console.log("hello, world!")
    # nil
end



