# ESimWeb

This repository contains the Unity WebGL player and its build files.

Before publishing a Unity build, run:

```sh
node scripts/split-unity-assets.mjs
```

The script splits `Build/Web.data` and `Build/Web.wasm` into parts smaller than 20 MB, removes the oversized originals, and writes `Build/assets.json`. The player loads and reassembles those parts before starting Unity. Include the manifest and all generated parts when publishing the `Build` directory.
