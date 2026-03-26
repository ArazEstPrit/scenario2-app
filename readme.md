# Modulus

Modulus is a local modular application which allows users to extend its
functionality. Users can create modules which dictate functionality. The app’s core acts like a foundation, which modules build on top of.

## Usage

Make sure you have NPM and Node.js installed, and your Node version is
`v22.18.0` or later. You can check this by running `node -v`.

Clone this repo, run `npm link` to link the app's binary, and start the app using
`modulus`.

### Creating Modules

Users are encouraged to create modules to customize their experience. To do so,
create your module directory in `src/modules`. Then create a `manifest.json`
file in the following format:

```jsonc
{
    "name": "" // Must match the folder name exactly. Must not include spaces
    "displayName": "" // User-friendly module name. Can include spaces
    "description": "" // Optional
    "entry": "" // Path to module entry point.
}
```

The module entry point must define an `init()` function, which will be run on
startup.

Modules can then create `Action`s, subscribe to events and interact with storage
`Store`s.
