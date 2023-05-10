require 'unloosen'

content_script do
    p 'content_script loaded'
end

popup do
    p 'popup loaded'
end

background do
    p 'backgound loaded'
end

on_installed do
    p 'this is on_install event'
end
