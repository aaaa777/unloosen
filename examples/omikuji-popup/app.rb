require "unloosen"

popup do
    # create button element
    button = document.createElement('button')
    button.innerText = 'draw omikuji'
    
    # create h2 element
    result = document.createElement('h2')
    
    # add event listener 'click'
    button.addEventListener 'click' do |e|
        result.innerText = ['lucky', 'unlucky'].sample
    end
    
    # load main contents
    main_div = document.getElementsByClassName('omikuji')[0]
    main_div.innerText = ''
    [result, button].each { |e| main_div.appendChild(e) }
end
