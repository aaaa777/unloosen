# Unloosen ruby loader

Unloosen is Chrome extension framework!


# Quickstart

1. create `app.rb`

```ruby
# app.rb
require "unloosen"

content_script site: "www.example.com" do
    h1 = document.getElementById("")
    h1.innerText = "Unloosen Example Page!"
end
```

2. create `manifest.json`

```json
{
    "manifest_version": 3,
    "name": "unloosen quickstart",
    "description": "this extension is running by ruby!",
    "version": "0.0.1",
    "content_scripts": [
        {
            "js": [
                "loader-content-script.esm.js"
            ],
            "matches": ["http://www.example.com/"]
        }
    ],
    "content_security_policy": {
        "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    },
    "web_accessible_resources": [
        {
          "resources": ["*"],
          "matches": ["<all_urls>"]
        }
    ]
}
```

3. download libraries

In this time, download `loader-content-script.esm.js` and `module-content-script.esm.js` and place same dir.

4. load extension

In your browser, toggle on developer mode and select `load unpackaged extension` then select current dir.

5. test run

access http://www.example.com/

when everything goes fine, the header will be "Unloosen Example Page!".

# examples

[example extensions](https://github.com/aaaa777/unloosen/tree/main/examples)

<!--download this template repository!-->


# how unloosen works

![wbRubykaigi2023Slide-how unloosen works drawio](https://github.com/aaaa777/unloosen/assets/27488794/a298e4e7-e85d-4f94-a02c-f745a0a9e916)

# supported function
|name|method alias|loadfile|
|:-|:-|:-|
|[Popup](https://developer.chrome.com/docs/extensions/reference/action/#manifest)|popup|`module-popup.esm.js`|
|[Content Script](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#static-declarative)|content_script|`loader-content-script.esm.js` and `module-content-script.esm.js`(both required)|
|[Background](https://developer.chrome.com/docs/extensions/mv3/service_workers/basics/#import-scripts)|background|`module-background.esm.js`|
|[SandBox(WIP)](https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/)|sandbox|`module-sandbox.esm.js`|
|[OnInstalled event](https://developer.chrome.com/docs/extensions/reference/runtime/#event-onInstalled)|on_installed|`module-background.esm.js`|



# Unloosen sample

https://github.com/aaaa777/unloosen-test-extension

TODO: Delete this and the text above, and describe your gem

## Installation

install with `npm i unloosen-ruby-loader`

after downloading, loader/module files in `node_modules/unloosen-ruby-loader/dist/entry/*.esm.js`

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/aaaa777/unloosen.
