# module JS; class Object;end;end
require "js.so"

# The JS module provides a way to interact with JavaScript from Ruby.
#
# == Example
#
#   require 'js'
#   JS.eval("return 1 + 2") # => 3
#   JS.global[:document].write("Hello, world!")
#   div = JS.global[:document].createElement("div")
#   div[:innerText] = "click me"
#   JS.global[:document][:body].appendChild(div)
#   div.addEventListener("click") do |event|
#     puts event          # => # [object MouseEvent]
#     puts event[:detail] # => 1
#     div[:innerText] = "clicked!"
#   end
#
# If you are using `ruby.wasm` without `stdlib` you will not have `addEventListener`
# and other specialized functions defined. You can still acomplish many
# of the same things using `call` instead.
#
# == Example
#
#   require 'js'
#   JS.eval("return 1 + 2") # => 3
#   JS.global[:document].call(:write, "Hello, world!")
#   div = JS.global[:document].call(:createElement, "div")
#   div[:innerText] = "click me"
#   JS.global[:document][:body].call(:appendChild, div)
#   div.call(:addEventListener, "click") do |event|
#     puts event          # => # [object MouseEvent]
#     puts event[:detail] # => 1
#     div[:innerText] = "clicked!"
#   end
#
module JS
  Undefined = JS.global[:undefined]
  Null = JS.global[:null]

  class PromiseScheduler
    Task = Struct.new(:fiber, :status, :value)

    def initialize(main_fiber)
      @tasks = []
      @is_spinning = false
      @loop_fiber =
        Fiber.new do
          loop do
            while task = @tasks.shift
              task.fiber.transfer(task.value, task.status)
            end
            @is_spinning = false
            main_fiber.transfer
          end
        end
    end

    def await(promise)
      current = Fiber.current
      promise.call(
        :then,
        ->(value) { enqueue Task.new(current, :success, value) },
        ->(value) { enqueue Task.new(current, :failure, value) }
      )
      value, status = @loop_fiber.transfer
      raise JS::Error.new(value) if status == :failure
      value
    end

    def enqueue(task)
      @tasks << task
      unless @is_spinning
        @is_spinning = true
        JS.global.queueMicrotask -> { @loop_fiber.transfer }
      end
    end
  end

  @promise_scheduler = PromiseScheduler.new Fiber.current

  def self.promise_scheduler
    @promise_scheduler
  end

  private

  def self.__eval_async_rb(rb_code, future)
    Fiber
      .new do
        future.resolve JS::Object.wrap(
                         Kernel.eval(
                           rb_code.to_s,
                           TOPLEVEL_BINDING,
                           "eval_async"
                         )
                       )
      rescue => e
        future.reject JS::Object.wrap(e)
      end
      .transfer
  end
end

class JS::Object
  def method_missing(sym, *args, &block)
    if self[sym].typeof == "function"
      self.call(sym, *args, &block)
    else
      super
    end
  end

  def respond_to_missing?(sym, include_private)
    return true if super
    self[sym].typeof == "function"
  end

  # Await a JavaScript Promise like `await` in JavaScript.
  # This method looks like a synchronous method, but it actually runs asynchronously using fibers.
  # In other words, the next line to the `await` call at Ruby source will be executed after the
  # promise will be resolved. However, it does not block JavaScript event loop, so the next line
  # to the `RubyVM.eval` or `RubyVM.evalAsync` (in the case when no `await` operator before the
  # call expression) at JavaScript source will be executed without waiting for the promise.
  #
  # The below example shows how the execution order goes. It goes in the order of "step N"
  #
  #   # In JavaScript
  #   const response = vm.evalAsync(`
  #     puts "step 1"
  #     JS.global.fetch("https://example.com").await
  #     puts "step 3"
  #   `) // => Promise
  #   console.log("step 2")
  #   await response
  #   console.log("step 4")
  #
  # The below examples show typical usage in Ruby
  #
  #   JS.eval("return new Promise((ok) => setTimeout(() => ok(42), 1000))").await # => 42 (after 1 second)
  #   JS.global.fetch("https://example.com").await                                # => [object Response]
  #   JS.eval("return 42").await                                                  # => 42
  #   JS.eval("return new Promise((ok, err) => err(new Error())").await           # => raises JS::Error
  def await
    # Promise.resolve wrap a value or flattens promise-like object and its thenable chain
    promise = JS.global[:Promise].resolve(self)
    JS.promise_scheduler.await(promise)
  end
end

# A wrapper class for JavaScript Error to allow the Error to be thrown in Ruby.
class JS::Error
  def initialize(exception)
    @exception = exception
    super
  end

  def message
    stack = @exception[:stack]
    if stack.typeof == "string"
      # Error.stack contains the error message also
      stack.to_s
    else
      @exception.to_s
    end
  end
end

# module Unloosen; module JS

#     Global = ::JS::global
#     Document = ::JS.global[:document]
#     Console = ::JS.global[:console]

#     Undefined = ::JS.eval("return undefined")
#     True = ::JS.eval("return true")
#     False = ::JS.eval("return false")
#     Null = ::JS.eval("return null")

#     attr_writer :auto_camelize

#     @auto_camelize = true

#     # monkey patching
#     class Object

#         def initialize(object)
#             @object = object
#         end

#         def [](sym)
#             @object[sym]
#         end

#         def []=(sym, val)
#             @object[sym, val]
#         end

#         # note: idk how do I get js methods and properties.
#         #       in addition, for browser, need more simpler logic to reduce code.
#         def method_missing(sym, *args, &blk)

#             if @object.respond_to?(sym)
#                 return self.class.new(@object.call(sym, *args, &blk))
#             end
            
#             # ex: add_listen_event => addListenEvent
#             if self[sym].typeof == "undefined" && @auto_camelize
#                 sym = sym.camelize
#             end

#             # call [] if not function
#             # ex: window.console => window[:console]
#             if args.empty? && !blk && self[sym].typeof != "function"
            
#                 return self[sym]

#             # call imidiately if function
#             else
            
#                 self.call(sym, args, &blk)
#             end
            
#         end

#         # call js function inside itself
#         def call(sym, *args, &blk)
#             @object.call(sym, *args.map{|arg| JS.try_convert(arg)}, &blk)
#         end

#         # ::JS.methods(false).each do |sym|
#         #     define_method(sym, ::JS.method(sym))
#         # end
#     end
    
#     class << self
    
#         attr_reader :undefined, :true, :false, :null
#         attr_reader :document, :window, :console

#         def try_convert(obj)
#             # return JS::Null if obj == nil
            
#             ::JS.try_convert(obj)
#         end

#         def eval(str)
#             ::JS.eval(str)
#         end
        
#         def self.promise_scheduler
#             @object.promise_scheduler
#         end
#     end

# end; end

# JS::Object.define_method(:to_unloosen_js) {
#     Unloosen::JS::Object.new(self)
# }

# # toplevel namespace overrides

# @document = Unloosen::JS::Document
# @window = Unloosen::JS::Global
# @console = Unloosen::JS::Console

# class << self
#     attr_reader :document, :window, :console
# end

# class Symbol

#     # ex: add_event_listener => addEventListener
#     def camelize
#         self.to_s.split("_").map.with_index do |w, i|
#             i == 0 ? w : w.capitalize
#         end.join.to_sym
#     end
# end
