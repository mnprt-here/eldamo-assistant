# Eldamo Assistant

A client-side web application designed to help learners study Neo-Quenya vocabulary and exercise sentences, directly complementing the [Eldamo course](https://eldamo.org/intro-quenya/index.html). This is not supposed to replace Eldamo, but act as a revision/test board. The database is built statically, so any changes to the original course will not reflect instantly here, and would require a manual data update. So, for any conflict or typos, [Eldamo](https://eldamo.org) has the trust priority.

This application is rigidly designed around my personal preferences, i.e. worksheets for quiz instead of flashcards (this forces me to write my answers on paper in one go, good for long term memory), segregating words and sentences by sections and not by their type, etc. Though the Engine has the capability (and functions) to segregate words by their types (nouns, verbs, adverbs, etc.), it is not connected to the HTML. If you want to customize the app based on your own preferences, the functionality is already there, but you will have to connect it to the front-end yourself. You may contact me if you need help parsing the code.

## Features

Revise and Quiz are restricted to the [Neo-Quenya course](https://eldamo.org/intro-quenya/index.html). For etymology or other details, please visit [Eldamo](https://eldamo.org).

* **Instant Search:** Seek words in both Neo-Quenya and English. 
* **Revise Mode:** Fetch and review a specific section of vocabulary and sentences.
* **Quiz Mode:** Customizable worksheets.
    * Prompt modes: Quenya to English, English to Quenya, or Mixed.
    * Shuffle question order to stop the brain from recalling answers by pattern.
    * "Show Answers" to reveal the translation.
* **Game Mode:** Games to test your vocabulary
    * Wordle: A classic wordle game from Neo-Quenya root words (no hyphens or extended forms)

## Usage: Search Parameters & Section Tags

The application uses a section tagging system based on the Eldamo course structure to fetch exactly the data you want to study.

* **Hierarchical Tags:** The section tags are completely versatile. 
    * Inputting `1.2.2` will fetch the data specifically from that sub-section. 
    * Inputting `1.2` will fetch the data from all sub-sections inside section 1.2. 
    * Inputting `1` will fetch the data for the entire chapter 1.
* **Revise Mode Search:** This search box takes **any single** section tag (e.g., `1.2`).
* **Quiz Mode Search:** This search box allows for compounding. It takes **multiple** section tags separated by commas (e.g., `1, 2.1, 3.4.2`).

## Technology Stack

* **Frontend:** Vanilla JavaScript (ES6), HTML5, CSS3.
* **Architecture:** Single Page Application (SPA) with dynamic DOM manipulation.
* **Data:** Client-side JSON/CSV databases.
* **Hosting:** GitHub Pages (No backend server required).

## Getting Started

Since this is a strictly client-side application, running it locally is incredibly simple:

1.  Clone this repository to your local machine.
2.  Open `index.html` in any modern web browser.
3.  *(Note)* You may need a simple local server (like VS Code's Live Server) to bypass browser CORS restrictions for local files.
4.  If you update the raw CSV database, please run builder.py to rebuild the JSON database.

## How to add other Tolkien languages to the app

You'll first need to download the [Eldamo lexion](https://github.com/pfstrack/eldamo/releases) as there's no landing page for browsing the options. Go to the folder `eldamo-x.x.xx/content/word-indexes/` and copy the desired language data to the Eldamo Assistant's [database](./database/) folder. Open the [html_scrapper.py](./html_scrapper.py) and set the `language_id` to match your html data file. Set the `uiLabel` to what you want to see on the Eldamo Assistant page, and a `search_key` for the `QueryEngine` to extract correct words from the database. Both `uiLabel` and `search_key` can be the same value. Running the scrapper will generate a `JSON` file with the same name. Use that name to load the `JSON` in the `loadDatabase()` function of the [app.js](./app.js). For example, to load Neo-Quenya, you do

```js
response = await fetch('./database/words-nq.json');
fullWordsDatabaseNQ = await response.json();
```

Add your new database to the `fullEngines`.

```js
const fullEngines = {
    ..., // Other engines
    [fullWordsDatabaseNQ.meta.languageID]: new QueryEngine(fullWordsDatabaseNQ, [])
};
```

Finally, add the option to select the new language in the [index.html](./index.html). Remember to match the `value` to the `language_id` you used.

```
<select id="global_lang_selector" class="corner-utility" name="Languages">
    <!-- Previous options -->
    <option value="nq">Neo-Quenya</option>
</select>
```

> **_NOTE_:** I have set specific rules in [html_scrapper.py](./html_scrapper.py) to decide which word is kept in the database. You may change them as per your requirement. For example, I reject all the words that start with a punctuation mark.

## Disclaimer

I am a back-end programmer, and this is my first ever front-end project. If anything breaks, please be a little kinder in your feedback. Since I don't have any background in stylizing web pages, the CSS file was generated completely by an AI (Gemini Pro).