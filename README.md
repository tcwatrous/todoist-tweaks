# todoist-tweaks
Unofficial Firefox extension for Todoist: custom accent color, task-complete sounds, and favicon. I felt like changing the accent color for Todoist dark mode, so I asked Claude for a simple addon that would allow me to do that. Decided that while I was doing that, I'd change the task complete sound and the favicon as well. 

> Not affiliated with or endorsed by Doist. Todoist is a trademark of Doist Inc.

## Features

- **Accent color:** pick any color (or one of 12 presets) and Todoist's accent changes everywhere, including its hover and pressed shades. Priority flags, overdue dates and project colors are left alone.
- **Task-complete sound:** replace Todoist's completion sound with one of 12 built-in sounds, from a soft pop to a little celebratory arpeggio. Includes a volume slider and a preview for each sound. Or keep Todoist's original.
- **White tab icon:** replace Todoist's red tab icon with a white one on a transparent background, which stands out on dark browser themes. Can be turned on or off from the popup.
- Changes apply live, with no page reload, and work with Todoist's light and dark themes.

## Install

### Try it (temporary)

1. Download or clone this repo.
2. In Firefox, go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `manifest.json`.
4. Reload your Todoist tab.

Temporary add-ons are removed when Firefox restarts.

## How it works

- **Accent color:** Todoist styles its interface with CSS custom properties. The extension finds them, works out which color is the current accent, and rewrites every variable close to that hue, shifting each shade by the same offset so hover and pressed states stay consistent with your color.
- **Complete sound:** Todoist plays its completion sound as an audio file. The extension hooks audio playback on the page and, when that file plays right after a task's checkbox is clicked, mutes it and plays the chosen sound instead. All sounds are generated in code with the Web Audio API, so no audio files are bundled.
- **Tab icon:** Todoist's icon links are hidden and the extension's icon is added in their place. A watcher puts it back if Todoist changes the icon.

## Privacy

The extension collects no data and sends nothing anywhere. Settings are stored locally in your browser. The only network requests it makes are to read Todoist's own stylesheets, to find its color variables.

## Permissions

- **Storage:** saves your color, sound and icon settings.
- **todoist.com and Todoist's asset domains:** runs on Todoist and reads its stylesheets.

## Built with

Plain JavaScript, HTML and CSS, with no build step. Built with help from Claude.

## License

[MIT](LICENSE)
