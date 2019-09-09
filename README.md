# Tidal Cycles VS Code extension

**Note** This is *not* the official repository. The offifical repository lives
[here](https://github.com/tidalcycles/vscode-extension)

## General info

The extension communicates with a GHCi instance via stdin/-out. That means
there's no magic involved and you can simply write GHCi code as well.

## Useful configuration

The sortcuts feature allows you to set up shortcuts for Tidal commands. While
the 1-9 predefined commands are useful, here are some more advanced
configuration ideas for your `keybindings.json`:

~~~~
    {
        "key": "cmd+t cmd+s"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "d#s# $ silence"
        }
    },
    {
        "key": "cmd+t cmd+m"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "mute #s#"
        }
    },
    {
        "key": "cmd+t cmd+n"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "unmute #s#"
        }
    },
    {
        "key": "cmd+t cmd+o"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "solo #s#"
        }
    },
    {
        "key": "cmd+t cmd+p"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "unsolo #s#"
        }
    },
    {
        "key": "cmd+t cmd+c"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "clutchIn #s# 4 $ #c#"
        }
    },
    {
        "key": "cmd+t cmd+x"
        , "command": "tidal.shortcut"
        , "args": {
            "command": "xfadeIn #s# 8 $ #c#"
        }
    }
~~~~


