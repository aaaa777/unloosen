

# Cargador de Ruby para Unloosen

¡Unloosen es un framework para extensiones de Chrome!


# Inicio rápido

1. Crea `app.rb`

```ruby
# app.rb
require "unloosen"

content_script site: "www.example.com" do
    h1 = document.getElementById("")
    h1.innerText = "Unloosen Example Page!"
end
```

2. Crea `manifest.json`

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

3. Descarga las bibliotecas

En este momento, descarga `loader-content-script.esm.js` y `module-content-script.esm.js` y colócalos en el mismo directorio.

4. Carga la extensión

En tu navegador, activa el modo de desarrollador y selecciona `Cargar extensión sin empaquetar`, luego selecciona el directorio actual.

5. Ejecuta la prueba

Accede a http://www.example.com/

Si todo funciona correctamente, el encabezado mostrará "Unloosen Example Page!".

# Ejemplos

[extensiones de ejemplo](https://github.com/aaaa777/unloosen/tree/main/examples)

<!--download this template repository!-->


# Cómo funciona Unloosen

![wbRubykaigi2023Slide-how unloosen works drawio](https://github.com/aaaa777/unloosen/assets/27488794/a298e4e7-e85d-4f94-a02c-f745a0a9e916)

# Funciones compatibles
|nombre|alias de método|archivo de carga|
|:-|:-|:-|
|[Popup](https://developer.chrome.com/docs/extensions/reference/action/#manifest)|popup|`module-popup.esm.js`|
|[Content Script](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#static-declarative)|content_script|`loader-content-script.esm.js` y `module-content-script.esm.js`(ambos requeridos)|
|[Background](https://developer.chrome.com/docs/extensions/mv3/service_workers/basics/#import-scripts)|background|`module-background.esm.js`|
|[SandBox(WIP)](https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/)|sandbox|`module-sandbox.esm.js`|
|[OnInstalled event](https://developer.chrome.com/docs/extensions/reference/runtime/#event-onInstalled)|on_installed|`module-background.esm.js`|



# Ejemplo de Unloosen

https://github.com/aaaa777/unloosen-test-extension

TODO: Elimina esto y el texto anterior, y describe tu gem

## Instalación

Instala con `npm i unloosen-ruby-loader`

Después de la descarga, los archivos del cargador/módulo se encuentran en `node_modules/unloosen-ruby-loader/dist/entry/*.esm.js`

## Cómo contribuir

Los informes de errores y las pull requests son bienvenidos en GitHub en https://github.com/aaaa777/unloosen.
