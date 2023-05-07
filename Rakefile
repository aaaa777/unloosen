# frozen_string_literal: true

require "bundler/gem_tasks"
#require "rspec/core/rake_task"

#RSpec::Core::RakeTask.new(:spec)

#task default: :spec

namespace :extension do
    desc "set bundler config and install dependencies."
    task init: [:download_wasm, :download_vfs, :download_node_module, :download_gem] do
    
    end
    task :download_gem do
        sh "bundle config set --local path 'vendor/bundle'"
        sh "bundle install"
    end
    
    task :download_node_module do
        sh "cd packages/unloosen-ruby && npm install"
    end
    
    task :download_vfs do
        sh "mkdir -p tools"
        vfsbin = "wasi-vfs-cli-x86_64-unknown-linux-gnu.zip"
        sh "cd tools && curl -LO https://github.com/kateinoigakukun/wasi-vfs/releases/download/v0.2.0/#{vfsbin} && unzip #{vfsbin}" if Dir.glob("tools/#{vfsbin}").empty?
    end
    
    task :download_wasm do
        sh "mkdir -p tools"
        wasmfile = "ruby-head-wasm32-unknown-wasi-full-js.tar.gz"
        sh "cd tools && curl -LO https://github.com/ruby/ruby.wasm/releases/latest/download/#{wasmfile} && tar xfz #{wasmfile}" if Dir.glob("tools/#{wasmfile}").empty?
    end

    desc "build release version."
    task pack: :init do
        sh "mkdir -p build"
        sh "tools/wasi-vfs pack packages/unloosen-ruby/node_modules/ruby-3_2-wasm-wasi/dist/ruby.debug+stdlib.wasm --mapdir /unloosen::./lib --mapdir /usr/local/lib/ruby/site_ruby/3.2.0::./lib/unloosen/utils --output ruby-packed.wasm"
        # sh "tools/wasi-vfs pack packages/unloosen-ruby/node_modules/ruby-head-wasm-wasi/dist/ruby.wasm --mapdir /unloosen::./lib --mapdir /usr/local/lib/ruby/site_ruby/3.2.0::./lib/unloosen/utils --output ruby-packed.wasm"
    end

end

namespace :build do
    desc "rollup"
    task :npm do
        sh "cd packages/unloosen-ruby && rollup -c"
        sh "cp packages/unloosen-ruby/dist/entry/module-popup.esm.js examples/omikuji-popup/"
    end

    desc "pack wasm"
    task :wasm do
        sh "tools/wasi-vfs pack packages/unloosen-ruby/node_modules/ruby-3_2-wasm-wasi/dist/ruby.debug+stdlib.wasm \
                --mapdir /unloosen::./lib \
                --mapdir /usr/local/lib/ruby/site_ruby/3.2.0::./lib/unloosen/utils \
                --output ruby-packed.wasm"
        sh "cp ruby-packed.wasm examples/omikuji-popup/"
    end
end

namespace :setup do
    task :npm do
        
    end

    task :bundler do

    end
end