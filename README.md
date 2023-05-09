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


# how unloosen works



# supported function
|name|class|alias|
|:-|:-|:-|
|[Popup](https://googledoc/popup)|Unloosen::Mode::Popup|popup do {}|
|[Content Script]()|Unloosen::Mode::ContentScript|content_script do {}|
|[Background]()|Unloosen::Mode::Background|background do {}|
|[SandBox]()|Unloosen::Mode::Sandbox|sandbox do {}|
|[OnInstalled event]()|Unloosen::Mode::OnInstalled|on_installed do {}|



# Unloosen sample

https://github.com/aaaa777/unloosen-test-extension

TODO: Delete this and the text above, and describe your gem

## Installation

Add this line to your application's Gemfile:

```ruby
gem 'unloosen'
```

And then execute:

    $ bundle install

Or install it yourself as:

    $ gem install unloosen

## Usage

TODO: Write usage instructions here

## Development

After checking out the repo, run `bin/setup` to install dependencies. Then, run `rake spec` to run the tests. You can also run `bin/console` for an interactive prompt that will allow you to experiment.

To install this gem onto your local machine, run `bundle exec rake install`. To release a new version, update the version number in `version.rb`, and then run `bundle exec rake release`, which will create a git tag for the version, push git commits and the created tag, and push the `.gem` file to [rubygems.org](https://rubygems.org).

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/[USERNAME]/unloosen.
