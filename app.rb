
# p JS.global[:chrome][:runtime].call(:getURL, "manifest.json")
require "unloosen"

# add_require_remote_uri "https://raw.githubusercontent.com/rtomayko/tilt/master/lib/"
# add_require_remote_uri "https://raw.githubusercontent.com/haml/haml/master/lib/"
# add_require_remote_uri "https://raw.githubusercontent.com/judofyr/temple/master/lib"
# require "haml"
# require "tilt"

# simple unloosen version like sinatro
#require_relative "lib/unloosen_simple"

# when popup message
#popup do
    # popup last value
    "テストメッセージ"
#end
p "app loaded"
# when load site
p "current_event: #{Unloosen::CURRENT_EVENT}"
p "on_installed: #{Unloosen.const_defined?("ON_INSTALLED")}"

on_installed do
    p chrome.contextMenus.create({
        "id": "sampleContextMenu",
        "title": "Sample Context Menu",
        "contexts": ["selection"]
    })
end

content_script sites: ["http://www.example.com/", /^*.google.com$/] do
    p("hello, world!")
    p alert("test")
end

background do
    console.log("hello, world3!")
end

popup do
    main_div = document.getElementsByClassName('omikuji')[0]
    btn = document.createElement('button')
    btn.innerText = 'draw omikuji'
    res = document.createElement('h2')

    btn.addEventListener('click') do |e|
        res.innerText = ['lucky', 'unlucky'].sample
    end

    main_div.innerText = ''
    main_div.appendChild(res)
    main_div.appendChild(btn)
end

