# Romaji Cards

Flashcards for building Japanese vocabulary from anime. Each card shows a word in romaji; tap to flip it and see the English meaning, then swipe to say whether you knew it.

The vocabulary comes from subtitle files, grouped by show. It currently covers Black Clover and One Piece, about 2,300 words in total.

## How it works

- **Tap** a card to flip it between the romaji and the meaning.
- **Swipe right** if you knew the word. It goes to the bottom of the pile.
- **Swipe left** if you didn't. It is slipped back in a few cards down, so it comes round again soon.
- A card can only be swiped once it has been flipped.
- The pile never ends: study a deck for as long as you like.

Progress is saved in the browser (`localStorage`), per device. The home screen lets you pick which decks to study and reset progress for one deck, the selected decks, or everything.

### Keyboard

| Key | Action |
|---|---|
| Space / Enter | Flip the card |
| → | Knew it |
| ← | Didn't know it |
| S | Speak the word |
| Z / Backspace | Undo the last swipe |
| Esc | Back to the decks |

### Speech

The speaker button on a card reads the word aloud in Japanese using the browser's built-in speech synthesis and the voices installed on the device. Nothing is downloaded and there is no API key.

- The button only appears if the device has a Japanese voice.
- If there are several Japanese voices, a picker appears on the home screen.
- On Windows, add a voice under Settings → Time & language → Speech → Manage voices. On Android, install Japanese voice data in the text-to-speech settings.

## Running it

Requires Node 20.19 or newer.

```bash
npm install
npm run dev
```

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address it prints.

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Adding vocabulary

Decks are plain text files in `src/decks/`. Each folder is a group (one show), and each `.txt` file inside it is a deck:

```
src/decks/
  black-clover/
    01-people.txt
    02-magic-world.txt
    ...
  one-piece/
    01-pirates-sea.txt
    ...
```

A deck file looks like this:

```
# Deck Title | Short description shown on the home screen
# other lines starting with # are comments

mahou | 魔法 | magic
akirameru | 諦める | to give up | "akiramenai" = I won't give up
```

Each line is `romaji | japanese | english | optional note`. The Japanese spelling is what the speech button reads, and the note appears under the meaning.

- **New word:** add a line to a deck file.
- **New deck:** add a `.txt` file to a group folder. Files are ordered by name, hence the number prefixes.
- **New show:** add a folder. Its name becomes the section title (`one-piece` → "One Piece").

Changing a word's romaji or Japanese spelling, or renaming its file or folder, resets the saved progress for that card.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages on every push to `main`. In the repository, set **Settings → Pages → Source** to **GitHub Actions** once.

## Built with

[Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com) and vanilla JavaScript. The font is [Outfit](https://fontsource.org/fonts/outfit), bundled with the app.

## A note on the word lists

The words were picked by counting how often they appear in each show's subtitles, keeping real vocabulary and leaving out names, attack names and sound effects. Most of the source subtitles are Japanese-only, so the English meanings were written separately and may contain mistakes. Corrections are welcome.
