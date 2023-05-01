# frozen_string_literal: true

require "spec_helper"

RSpec.describe Unloosen do
  it "has a version number" do
    expect(Unloosen::VERSION).not_to be nil
  end

  it "is something useful" do
    expect(true).to eq(true)
  end

  describe "#chrome extension" do

    let(:window) { Unloosen::JS.window }
    let(:document) { Unloosen::JS.document }
    let(:console) { Unloosen::JS.console }

    context "#check global vals" do
      it { expect(window).to eq ::JS::global[:window] }
      it { expect(document).to eq ::JS::global[:document] }
      it { expect(console).to eq ::JS::global[:console] }
    end

  end
end
