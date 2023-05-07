require "unloosen"

popup do
    main_div = document.getElementsByClassName('omikuji')[0]
    btn = document.createElement('button')
    btn.innerText = 'draw omikuji'
    res = document.createElement('h2')

    btn.addEventListener('click') do |e|
        res.innerText = ['lucky', 'unlucky'].sample
    end
    
    main_div.innerText = ''
    main_div.appendChild(res)
    main_div.appendChild(btn)
end
