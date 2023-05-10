# patched js.rb
# see also: https://ongaeshi.hatenablog.com/entry/access_properties_from_jsobject_in_function_style
require "js.so"
require "json"

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

  def self.try_convert_hash(obj)
    return nil unless obj.respond_to?(:to_json)
    JS.global[:JSON].parse(JS.try_convert(obj.to_json))
  end

end

class JS::Object
  def method_missing(sym, *args, &block)
    ret = self[sym]

    case ret.typeof
    when "undefined"
      str = sym.to_s
      if str[-1] == "="
        self[str.chop.to_sym] = args.first
        return args.first
      end

      super
    when "function"
      self.call(sym, *args.map, &block).to_rb
    else
      ret.to_rb
    end
  end

  def respond_to_missing?(sym, include_private)
    return true if super
    self[sym].typeof != "undefined"
  end

  def to_rb
    case self.typeof
    when "number"
      self.to_f
    when "string"
      self.to_s
    else
      self
    end
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

class Object
  # def to_js
  #   return self if self.is_a?(JS::Object)
  #   JS.try_convert(self) || JS.try_convert_hash(self)
  # end

  def to_rb
    self
  end
end