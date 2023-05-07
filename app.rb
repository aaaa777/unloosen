
# p JS.global[:chrome][:runtime].call(:getURL, "manifest.json")
require "unloosen"
require "unloosen/toplevel_alias"

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
p Unloosen::CURRENT_EVENT

#on_installed do

#  end

content_script sites: ["http://www.example.com/", /^*.google.com$/] do
    p("hello, world!")
    p window
    p document
    p console.log("hello, world2!")
    p chrome
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

