
# p JS.global[:chrome][:runtime].call(:getURL, "manifest.json")

# simple unloosen version like sinatro
#require_relative "lib/unloosen_simple"

# when popup message
popup do
    # popup last value
    "テストメッセージ"
end

# when load site
content_script sites: ["example.com", /^*.google.com$/] do
    console.log("hello, world!")
    # nil
end



