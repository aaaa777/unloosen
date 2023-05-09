#!/usr/bin/env ruby

filepath = ARGV.first

File.open(filepath, "r+") do |file|
    code = file.read()
    file.write(code.gsub("\n\w*", ";"))
end