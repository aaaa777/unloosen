require "unloosen"

content_script site: "www.example.com" do
    document.querySelector("h1").innerText = "Example Page with ruby.wasm!"
    document.body.style.backgroundColor = "crimson"
end