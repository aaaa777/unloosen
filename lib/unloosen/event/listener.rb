require_relative 'event_container'

module Unloosen; module Event

    class Listener
        @@listeners = []

        def initialize(type, &callback)
            @type = type.to_s
            @callback = callback
            @@listeners << self
        end

        def call(type, event_container = nil)
            @callback.call(event_container) if type.to_s == @@type
        end

        def self.emit_event(type)
            @@listeners.each do |e|
                e.call(type)
            end
        end

        
    end
end; end