let wordsDatabase = [];
let sentencesDatabase = [];

class QueryEngine {
    /**
     * Initializes the engine
     * @param {Array} wordsDatabase 
     * @param {Array} sentencesDatabase 
     */
    constructor(wordsDatabase, sentencesDatabase) {
        this.words = wordsDatabase.reduce((accumulator, word) => {
            accumulator[word.id] = word;
            return accumulator;
        }, {});
        this.sentences = sentencesDatabase.reduce((accumulator, sentence) => {
            accumulator[sentence.id] = sentence;
            return accumulator;
        }, {});

    }

    /**
     * Removes diacritics and lowercases the string for strict matching.
     * @param {String} text - String that needs to be removed from diacritics
     * @returns {String} - string with diacritics removed
     */
    static normalizeString(text) {
        if (!text) return "";
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * Quick access to the words and sentences if ids are known
     * @param {String} itemId - id of the query word or sentence
     * @returns - word or sentence of the given id
     */
    getById(itemId) {
       if (itemId.startsWith("w_")) {
            return this.words[itemId] || null;
       }
       else if (itemId.startsWith("s_")) {
        return this.sentences[itemId] || null;
       }
       return null;
    }

    /**
     * Returns all the words and sentences from the specific section or chapter.
     * @param {String} sectionTag - The section identifier (e.g. '1.2.1')
     * @param {String} target - Which database to search ('words', 'sentences', 'both'). Defaults to 'both'.
     * @returns {Array} - Array of matching word/sentence objects
     */
    getBySection(sectionTag, target = 'both') {
        const results = [];

        // Helper arrow function for strictly left-aligned, dotted boundary matching
        const isMatch = (link, tag) => {
            // If the 'eldamo-link' key doesn't exist, return false.
            if (!link) return false; 
            return link === tag || link.startsWith(`${tag}.`);
        };

        // Search the words database
        if (target === 'words' || target === 'both') {
            for (const w of Object.values(this.words)) {
                for (const link of w['eldamo-link']) {
                    if (isMatch(link, sectionTag)) {
                        results.push(w);
                        break;
                    }
                }
            }
        }
        
        // Search the sentences database
        if (target === 'sentences' || target === 'both') {
            for (const s of Object.values(this.sentences)) {
                for (const link of s['eldamo-link']) {
                    if (isMatch(link, sectionTag)) {
                        results.push(s);
                        break;
                    }
                }
            }
        }
        
        return results;
    }

    /**
     * Returns the ids of sentences which contain the word with item_id, and vice-versa
     * @param {String} itemId - id of the query word or sentence 
     * @returns array of ids of the linked words or sentences
     */
    getLinkedItems(itemId) {
        const item = this.getById(itemId);
        // If no item detecded with itemId
        if (!item) return null;
        // Return the ids of linked items
        return item['other-ids'] || [];
    }

    /**
     * Returns the complete detail of the query word from the database. 
     * The diacritics are not necessary.
     * @param {String} query - word to search for, diacritics are not necessary
     * @param {String} language - which language to serach in: quenya, or english
     * @returns complete detail of the query word or sentence 
     */
    search(query, language) {
        const results = [];
        query = QueryEngine.normalizeString(query);
        language = language.toLowerCase();

        for (const word of Object.values(this.words)) {
            const normalizedWord = QueryEngine.normalizeString(word[language] || '');
            if (normalizedWord.includes(query)) {
                results.push(word);
            }
        }
        return results;
    }
}

/**
 * Quiz Engine is used to create mock tests from the database.
 * The user has the option to select specific section/chapter.
 * The generated questions can be limited, and either ordered or randomized.
 */
class QuizEngine {
    /**
     * Initializes the engine
     * @param {QueryEngine} databaseEngine 
     */
    constructor(databaseEngine) {
        this.db = databaseEngine;
        this.currentQuizItems = [];
        // Default test is from the whole chapter 1
        this.sections = ['1'];
        // Default test only uses sentences
        this.dataType = 'sentences';
        // Empty wordTypes chooses all words for the test
        // e.g. n (noun), v (verb), pron (pronoun), etc: see setWordTypes()
        this.wordTypes = [];
        // Maximum numbers of questions to generate
        this.maxNum = 0;
        // Mode of the quiz -> random / ordered
        this.mode = 'ordered';
    }

    /**
     * Forces the engine to generate quiz from the selected sections only
     * @param {Array} sectionTagList : 'eldamo-link' of the required section
     */
    setSections(sectionTagList) {
        if (sectionTagList.length != 0) {
            this.sections = sectionTagList;
        }
        else {
            console.log(`Invalid List. Reverting to default: ${this.sections}`);
            return;
        }

        // Clean the input: strip spaces and remove exact string duplicates
        const cleanedTags = [];
        for (const s of sectionTagList) {
            const stripped = s.trim();
            if (stripped){
                cleanedTags.push(stripped);
            }
        }

        // Sort by length so we process parents (shorter) before children (longer)
        cleanedTags.sort(function(current, next) {return current.length - next.length;});

        const optimizedTags = [];
        for (const tag of cleanedTags) {
            const isRedundant = false;
            for (const parent of optimizedTags) {
                if (tag.startsWith(`${parent}.`)) {
                    isRedundant = true;
                    break;
                }
            }
            if (!isRedundant) {
                optimizedTags.push(tag);
            }
        }

        this.sections = optimizedTags;
    }

    /**
     * Sets a limit on the maximum number of questions that can be generated
     * @param {Number} maxNum 
     */
    setLimiter(maxNum) {
        if (maxNum < 0) {
            console.log("Invalid limiter.");
            return;
        }
        this.maxNum = maxNum;
    }

    /**
     * Which data should be used to create the test? -> words, sentences
     * @param {String} dataType 
     */
    setDataType(dataType) {
        if (dataType === 'words' || dataType === 'sentences') {
            this.dataType = dataType;
        }
        else {
            console.log(`Invalid data choice: ${dataType}`);
        }
    }

    /**
     * Which types of words should be used to create the test?
     *      -> n (noun), v (verb), pron (pronoun), adj (adjective), adv (adverb), suf (suffix), prep (preposition)
     *         conj (conjunction), suf (suffix), num (number), interj (interjection)
     * @param {Array} wordTypeList 
     */
    setWordType(wordTypeList) {
        this.wordTypes = wordTypeList;
    }

    /**
     * Set the mode of the quiz -> random, ordered
     * @param {String} mode 
     */
    setMode(mode) {
        if (mode === 'random' || mode === 'ordered') {
            this.mode = mode;
        }
        else {
            console.log(`Invalid mode: ${mode}`);
        }
    }

    /**
     * Generates the quiz
     */
    generateQuiz() {
        // Clear the previous quiz items
        this.currentQuizItems = [];
        for (const section of this.sections) {
            this.currentQuizItems = this.currentQuizItems.concat(this.db.getBySection(section, this.dataType));
        }

        // Remove the duplicates of words that appear in multiple sections
        this.currentQuizItems = Array.from(
            new Map(this.currentQuizItems.map(item => [item.id, item])).values()
        );

        if (this.dataType === 'words' && this.wordTypes.length != 0) {
            this.currentQuizItems = this.currentQuizItems.filter(item => {
                // If the user's requested wordTypes array includes this item's type, keep it!
                return this.wordTypes.includes(item['word-type']); 
            });
        }

        // If no data is found
        if(this.currentQuizItems.length === 0) {
            console.log("No appropriate data found.")
            return [];
        }

        // Set the correct max number of questions that can be generated
        const currentQuizLength = this.currentQuizItems.length;
        let actualMax = this.maxNum;
        if (actualMax === 0 || (actualMax > currentQuizLength)) {
            actualMax = currentQuizLength;
        }
        // Choose the mode and return the generated quiz
        if (this.mode === 'random') {
            return this.currentQuizItems.sort(function (a, b) {
                return Math.random() - 0.5;
            });
        }
        else {
            return this.currentQuizItems.slice(0,actualMax);
        }
    }
}

/**
 * A pseudo interface for all games
 */
class Game {
    constructor() {}
}

/**
 * Wordle game class
 */
class Wordle extends Game {
    /**
     * Initialize the wordle board
     * @param {QueryEngine} engine - A query engine containing words
     * @param {number} wordLength - Length of the wordle word (Currenly 'clean' words of length 5 are most prominent in the database)
     * @param {number} maxGuessNum - Maximum number of allowed guesses (use analyzeWordDifficulty() to get an estimate for it)
     */
    constructor(engine, wordLength = 5, maxGuessNum = 5) {
        super();
        this.wordLength = wordLength;
        this.words = this.filterWords(Object.values(engine.words)); // Array of filtered (uncleaned) words
        this.targetWord = "";
        this.currentGuess = "";
        this.currentGuessNum = 0;
        this.maxGuessNum = maxGuessNum;
        this.isGameOver = false;
        this.colors = new Array(this.wordLength);
        this.reset();
    }

    /**
     * Reset the whole board
     */
    reset() {
        this.setNewTargetWord();
        this.currentGuess = "";
        this.currentGuessNum = 0;
        this.isGameOver = false;
        this.colors.fill("absent");
        // console.log(this.targetWord);
    }

    /**
     * 
     * @param {Object} words - A dictionary of unfiltered words
     * @param {RegExp} regex - A cleanup regex (removes ()'s and -'s)
     * @returns {Array} - An array of words that match the wordle criteria
     */
    filterWords(words, regex = /-|\s*\([^)]*\)/g) {
        // Copy the cleaned words which have the correct length
        return words.filter(item => item.quenya.replace(regex,"").length === this.wordLength)
            .map(item => ({
                ...item, // copying
                quenya: item.quenya.replace(regex,"") // cleaning
            }));
    }

    /**
     * Extracts a random word from the this.words Array
     * @returns {String} - A normalized word from the this.words Array
     */
    getRandomWord() {
        if (this.words.length === 0) {
            return null;
        }
        return QueryEngine.normalizeString(this.words[Math.floor(Math.random() * (this.words.length + 1))].quenya);
    }

    /**
     * Sets a new target word for the board
     */
    setNewTargetWord() {
        this.targetWord = this.getRandomWord();
    }

    /**
     * Sets the current guess of the board
     * @param {String} guess - A string containing new guess 
     */
    setNewCurrentGuess(guess) {
        this.currentGuess = guess;
    }

    /**
     * Compares the current guess and target word
     * Also assigns the color property to the board tiles
     */
    compareCurrentGuess() {
        if (this.currentGuess === this.targetWord) {
            this.colors.fill("correct");
            this.gameOver(true);
        }
        else {
            let guessArr = this.currentGuess.split('');
            let targetArr = this.targetWord.split('');
            this.colors.fill("absent");
            for (let i = 0; i < this.wordLength; i++) {
                if (guessArr[i] === targetArr[i]) {
                    this.colors[i] = "correct";
                    targetArr[i] = null; // Cross off target
                    guessArr[i] = null;  // Cross off guess
                }
            }
            for (let i = 0; i < this.wordLength; i++) {
                if (guessArr[i] === null) continue; // Skip if already green

                const targetIndex = targetArr.indexOf(guessArr[i]);
                if (targetIndex !== -1) {
                    this.colors[i] = "present";
                    targetArr[targetIndex] = null; // Cross off so it can't be used again
                }
            }
            this.currentGuessNum += 1;
            if (this.currentGuessNum >= this.maxGuessNum) {
                this.gameOver(false);
            }
        }
    }

    /**
     * Game Over
     * @param {Boolean} isSuccess - Is the game ended with success or failure
     */
    gameOver(isSuccess) {
        if (isSuccess) {
            this.showToast("Good job.");
        }
        else {
            this.showToast("Correct word: " + this.targetWord.toUpperCase());
        }
        this.isGameOver = true;
    }

    /**
     * Processes the key input
     * @param {String} key - The pressed key 
     * @returns - void
     */
    handleInput(key) {
        if (key === "enter") {
            if (this.currentGuess.length < this.wordLength) return;
            // Check if the word exist in the valid word list (restricted to the database)
            const isValidWord = this.words.some(
                word => QueryEngine.normalizeString(word.quenya) === this.currentGuess
            );
            if (!isValidWord) {
                this.shakeCurrentRow();
                return; 
            }
            this.compareCurrentGuess();
            this.applyColorToRow();
            this.applyColorToKeyboard();
            // Consume the current guess
            this.currentGuess = "";
            
        } else if (key === "backspace") {
            // Remove the last letter
            if (this.currentGuess.length > 0) {
                this.setNewCurrentGuess(this.currentGuess.slice(0, -1));
            }
        } else {
            // Add a letter (if there is space)
            if (this.currentGuess.length < this.wordLength) {
                // Replace all C's with K's
                const normalizedKey = key.replace(/c/g,"k");
                this.setNewCurrentGuess(this.currentGuess + normalizedKey);
            }
        }
        this.updateWordleBoard();
    }

    /**
     * Updates the text of current row of the board
     * @returns - void
     */
    updateWordleBoard() {
        const board = document.querySelectorAll(".wordle-board div");
        if (!board || this.isGameOver) return;
        
        const startIndex = this.currentGuessNum * this.wordLength;
        // Update only the tiles in the current row
        for (let col = 0; col < this.wordLength; col++) {
            // Inject the letter if it exists, otherwise fallback to "-"
            board[startIndex + col].textContent = this.currentGuess[col] ? this.currentGuess[col].toUpperCase() : "-";
        }

        board.forEach((tile, index) => {
            // Calculate which row this specific tile lives in
            const tileRow = Math.floor(index / this.wordLength);
            
            // If the tile is in the current row, AND the game isn't over, highlight it
            if (tileRow === this.currentGuessNum && !this.isGameOver) {
                tile.classList.add("active-tile");
            } else {
                tile.classList.remove("active-tile");
            }
        });
    }

    /**
     * Applies the color to the tiles of the appropriate row
     * @returns - void
     */
    applyColorToRow() {
        const board = document.querySelectorAll(".wordle-board div");
        if (!board) return;
        // Find the row of submitted guess (either current or previous)
        const startIndex = (this.isGameOver && this.currentGuessNum < this.maxGuessNum) ? this.currentGuessNum * this.wordLength : (this.currentGuessNum-1) * this.wordLength;
        // Failsafe to ignore negative out of bounds index
        if (startIndex < 0) return;
        for (let col = 0; col < this.wordLength; col++) {
            // Set the correct color to the board tile
            board[startIndex + col].classList.add(this.colors[col]);
        }
    }

    /**
     * Applies color to the on-screen keyboard keys
     */
    applyColorToKeyboard() {
        for (let i = 0; i < this.wordLength; i++) {
            const letter = this.currentGuess[i];
            const color = this.colors[i];

            // LINKING C AND K: If it's one of them, target both. Otherwise, just target the letter.
            const keysToUpdate = (letter === "c" || letter === "k") ? ["c", "k"] : [letter];

            for (const keyLetter of keysToUpdate){
                const keyButton = document.querySelector(`.key[data-key="${keyLetter}"]`);
                
                if (!keyButton) continue;
                
                // Enforce color hierarchy: Correct > Present > Absent
                if (keyButton.classList.contains("correct")) {
                    continue; // Never downgrade a green key
                }
                
                if (keyButton.classList.contains("present") && color === "absent") {
                    continue; // Reject color downgrade
                }
                
                // Strip any existing colors and apply the highest earned color
                keyButton.classList.remove("present", "absent");
                keyButton.classList.add(color);
            }
        }
    }

    /**
     * Applies the shake effect for invalid word submission
     * @returns - void
     */
    shakeCurrentRow() {
        const board = document.querySelectorAll(".wordle-board div");
        if (!board) return;

        const startIndex = this.currentGuessNum * this.wordLength;

        for (let col = 0; col < this.wordLength; col++) {
            // Get the text tile in current row of the board
            const tile = board[startIndex + col];
            
            // Add the animation class to the tile
            tile.classList.add("shake");
            
            // Remove the class when the animation finishes
            tile.addEventListener("animationend", () => {
                tile.classList.remove("shake");
                }, { once: true }
            ); 
        }
    }

    /**
     * Shows a message pop-up
     * @param {String} message - String of what to show
     */
    showToast(message) {
        const toast = document.createElement("div");
        toast.textContent = message;
        toast.classList.add("wordle-toast");
        
        // Append it to the main games container
        document.getElementById("games_content").appendChild(toast);

        // Remove the toast after 3 seconds
        setTimeout(() => {
            toast.classList.add("fade-out");
            // Wait for the fade animation to finish before removing from DOM
            toast.addEventListener("animationend", () => toast.remove(), { once: true });
        }, 3000);
    }

    /**
     * A helper hunction to find appropriate this.maxGuessnum
     * For a trap size of 3-4, this.maxGuessnum can be set to 5 for fairness
     * For a bigger trap size, increase the this.maxGuessnum appropriately
     * Desclaimer: Constructed by Gemini Pro
     */
    analyzeWordDifficulty() {
        setTimeout(() => {
            const wordList = this.words.map(w => QueryEngine.normalizeString(w.quenya));
            const patterns = {};

            // Map out every possible 1-letter difference (e.g., "m_kil")
            wordList.forEach(word => {
                for (let i = 0; i < 5; i++) {
                    const pattern = word.slice(0, i) + "_" + word.slice(i + 1);
                    if (!patterns[pattern]) patterns[pattern] = [];
                    
                    if (!patterns[pattern].includes(word)) {
                        patterns[pattern].push(word);
                    }
                }
            });

            // Filter for dangerous traps (groups of 4 or more similar words)
            const traps = Object.entries(patterns)
                .filter(([pattern, group]) => group.length >= 4)
                .sort((a, b) => b[1].length - a[1].length); // Sort biggest to smallest

            // Print the report to the console
            console.log("=== QUENYA WORDLE DIFFICULTY REPORT ===");
            if (traps.length === 0) {
                console.log("Zero deep traps found! 5 guesses is perfectly balanced.");
            } else {
                traps.forEach(([pattern, group]) => {
                    console.log(`Pattern ${pattern.toUpperCase()} has ${group.length} words:`, group.join(", "));
                });
            }
        }, 1000); // 1 second delay ensures the database is fully loaded first
    }
}

// ---------------------------------------------------------
// DOM MANIPULATION & UI LOGIC
// ---------------------------------------------------------

/**
 * Universal function to render cards to prevent duplicating code.
 * @param {Array} results - The data to display
 * @param {HTMLElement} container - The DOM element to inject HTML into
 * @param {String} mode - Is it a search or quiz page?
 * @param {String} target - Is the card for words (to show the word types) or sentences?
 */
function renderCards(results, container, mode="search", target="") {
    if (results.length === 0) {
        container.innerHTML = "<h3 class='empty-state'>No matches found in the archives.</h3>";
        return;
    }
    let wordTypeSuffix = "";
    let htmlString = "";
    for (const item of results) {
        if (target === 'words') {
            wordTypeSuffix = " (" + item.type + ")";
        }
        else {
            wordTypeSuffix = "";
        }
        const quenyaWord = item.quenya + wordTypeSuffix || "Unknown";
        const englishWord = item.english || "Unknown";
        
        if (mode === "quiz") {
            const promptWord = (item.promptLang === "english") ? englishWord : quenyaWord;
            const answerWord = (item.promptLang === "english") ? quenyaWord : englishWord;
            const answerLabel = (item.promptLang === "english") ? "Quenya" : "English";
            
            htmlString += `
                <div class="result-card">
                    <h3>${promptWord}</h3>
                    <div class="answer-key hidden">
                        <p><strong>${answerLabel}:</strong> ${answerWord}</p>
                    </div>
                </div>
            `;
        } else {
            // The Standard Search/Revise Card
            htmlString += `
                <div class="result-card">
                    <h3>${quenyaWord}</h3>
                    <p><strong>Translation:</strong> ${englishWord}</p>
                </div>
            `;
        }
    }
    container.innerHTML = htmlString;
}

/**
 * Renders a clean Wordle board and an On-Screen keyboard
 * @param {Wordle} wordleGame - The fully initialized wordle game
 * @param {HTMLElement} container - The DOM element to inject HTML into
 */
function renderWordleBoard(wordleGame, container) {
    container.innerHTML = "";
    let htmlString = "";

    // The wordle grid
    htmlString += `<div class="wordle-board" style="--cols: ${wordleGame.wordLength}; --rows: ${wordleGame.maxGuessNum};">`;
    for (let row = 0; row < wordleGame.maxGuessNum; row++) {
        for (let col = 0; col < wordleGame.wordLength; col++) {
            if (row===0) {
                htmlString += `<div class="active-tile">-</div>`;
            }
            else{
                htmlString += `<div>-</div>`;
            }
        }
    }
    htmlString += `</div>`;

    // Add a custom On-Screen Keyboard
    htmlString += `
    <div id="keyboard-container">
        <div class="keyboard-row">
        <button class="key" data-key="q">Q</button>
        <button class="key" data-key="w">W</button>
        <button class="key" data-key="e">E</button>
        <button class="key" data-key="r">R</button>
        <button class="key" data-key="t">T</button>
        <button class="key" data-key="y">Y</button>
        <button class="key" data-key="u">U</button>
        <button class="key" data-key="i">I</button>
        <button class="key" data-key="o">O</button>
        <button class="key" data-key="p">P</button>
    </div>
    <div class="keyboard-row">
        <button class="key" data-key="a">A</button>
        <button class="key" data-key="s">S</button>
        <button class="key" data-key="d">D</button>
        <button class="key" data-key="f">F</button>
        <button class="key" data-key="g">G</button>
        <button class="key" data-key="h">H</button>
        <button class="key" data-key="j">J</button>
        <button class="key" data-key="k">K</button>
        <button class="key" data-key="l">L</button>
    </div>
    <div class="keyboard-row">
        <button class="key action-key" data-key="enter">ENTER</button>
        <button class="key" data-key="z">Z</button>
        <button class="key" data-key="x">X</button>
        <button class="key" data-key="c">C</button>
        <button class="key" data-key="v">V</button>
        <button class="key" data-key="b">B</button>
        <button class="key" data-key="n">N</button>
        <button class="key" data-key="m">M</button>
        <button class="key action-key" data-key="backspace">⌫</button>
    </div>
    </div>
    `;

    // Inject the htmlString
    container.innerHTML = htmlString;
}

/**
 * Interface between search page and javascript
 * @param {QueryEngine} engine - used to query the database
 * @param {QuizEngine} quizEngine - used to generate custom quiz
 */
function initUI(engine, quizEngine) {
    // --- 1. NAVIGATION LOGIC ---
    const navButtons = document.querySelectorAll('nav button');
    const views = {
        'Search': document.getElementById('search'),
        'Revise': document.getElementById('revise'),
        'Quiz': document.getElementById('quiz'),
        'Games' : document.getElementById('games')
    };

    // Listen to all nav buttons to switch tabs
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Hide everything
            Object.values(views).forEach(view => view.classList.add('hidden'));
            // Show the one that matches the button text
            const targetView = views[e.target.textContent];
            if (targetView) targetView.classList.remove('hidden');
        });
    });

    /*
    // Listen to any clicks on the result board containing result cards
    // Use this block for individual flashcard clicking
    document.getElementById('main_board').addEventListener('click', (e) => {
        const clickedCard = e.target.closest('.result-card');
        if (!clickedCard) return;

        // Following code will run only if a result-card exists
        console.log(`${clickedCard.innerHTML}`);
        //const tray = clickedCard.querySelector('.details-tray');
        //if (tray) {
        //    tray.classList.toggle('hidden');
        //}
    });
    */

    // Variable to store results across multiple events
    let results = [];

    // --- 2. SEARCH LOGIC ---
    const searchForm = document.getElementById("search_form");
    const searchQuery = document.getElementById("search_query");
    const searchResults = document.getElementById("search_results");

    searchForm.addEventListener('input', (e) => {
        // e.preventDefault();
        const query = searchQuery.value.trim();
        const lang = document.querySelector('input[name="search_lang"]:checked')?.value;

        if (!query || !lang) {
            searchResults.innerHTML = "";
            return;
        }
        results = engine.search(query, lang);
        renderCards(results, searchResults, "search", "words");
    });

    // --- 3. REVISE LOGIC ---
    const fetchBtn = document.getElementById("fetch_btn");
    const reviseSectionInput = document.getElementById("revise_section");
    const reviseSectionList = document.getElementById("revise_section_list");
    const reviseResultsContainer = document.getElementById("revise_results");

    fetchBtn.addEventListener('click', () => {
        const sectionTag = reviseSectionInput.value.trim();
        // Force to lowercase to match your engine's expectations ('words' or 'sentences')
        const target = reviseSectionList.value.toLowerCase(); 

        if (!sectionTag) return;

        results = engine.getBySection(sectionTag, target);
        renderCards(results, reviseResultsContainer, "search", target);
    });

    // --- 4. QUIZ LOGIC ---
    const quizGenBtn = document.getElementById("quiz_generate_btn");
    const quizShowAnsBtn = document.getElementById("quiz_show_answers_btn");
    const quizSectionInput = document.getElementById("quiz_section");
    const quizDataType = document.getElementById("quiz_data_type");
    const quizResultsContainer = document.getElementById("quiz_results");

    quizGenBtn.addEventListener('click', () => {
        const quizSectionTag = quizSectionInput.value.trim();
        const quizTarget = quizDataType.value.toLowerCase();

        const quizPromptLang = document.getElementById("quiz_prompt_lang").value;
        const quizModeIsRandom = document.getElementById("quiz_mode").checked;

        if (!quizSectionTag) return;

        // Initialize the QuizEngine
        quizEngine.setSections(quizSectionTag.split(","));
        quizEngine.setDataType(quizTarget);
        quizEngine.setMode(quizModeIsRandom ? "random" : "ordered");
        results = quizEngine.generateQuiz();

        // Set the quiz promt language: quenya, english, mixed
        // Creating results clone to avoid modifying true data
        const resultsClone = results.map(item => {
            // Determine the language for this specific card
            const selectedLang = quizPromptLang === "mixed" 
                ? (Math.random() > 0.5 ? "quenya" : "english") 
                : quizPromptLang;
                
            // Return a NEW object that copies the original database item (...item)
            // and safely adds temporary quiz state to it.
            return {
                ...item,
                promptLang: selectedLang
            };
        });

        // Show the quiz questions
        renderCards(resultsClone, quizResultsContainer, "quiz", quizTarget);

        // Show the reveal answers button
        if (resultsClone.length !== 0) {
            quizGenBtn.classList.add("hidden");
            quizShowAnsBtn.classList.remove("hidden");
        }
    });

    quizShowAnsBtn.addEventListener('click', () => {
        // Button is no longer need to be shown
        quizShowAnsBtn.classList.add("hidden");
        quizGenBtn.classList.remove("hidden");

        const answers = document.querySelectorAll('.answer-key');
        answers.forEach(ans => ans.classList.remove('hidden'));
    });

    // --- 5. GAMES LOGIC ---
    const gamesContent = document.getElementById('games_content')
    const gamesWordleBtn = document.getElementById('games_wordle_btn');
    
    let wordleGame;
    gamesWordleBtn.addEventListener('click', () => {
        // Initiate the Wordle game
        wordleGame = new Wordle(engine, 5, 5);
        renderWordleBoard(wordleGame, gamesContent);
        
        // Focus on the gamesContent to read Keyboard inputs
        gamesContent.focus();
    });
    // 5.1. Listen for Physical Keyboard
    gamesContent.addEventListener("keydown", (e) => {
        if (!wordleGame) return;
        
        if (wordleGame.isGameOver) {
            wordleGame.reset();
            // Clean the board
            renderWordleBoard(wordleGame, gamesContent);
            return;
        }
        
        if (e.key === "Enter") {
            wordleGame.handleInput("enter");
        } else if (e.key === "Backspace") {
            wordleGame.handleInput("backspace");
        } else if (/^[a-zA-Z]$/.test(e.key)) { // Regex ensures it's a single letter
            wordleGame.handleInput(e.key.toLowerCase());
        }
    });
    // 5.2. Listen for On-Screen Keyboard if active
    gamesContent.addEventListener("click", (e) => {
        if (!wordleGame) return;

        if (wordleGame.isGameOver) {
            wordleGame.reset();
            // Clean the board
            renderWordleBoard(wordleGame, gamesContent);
            return;
        }
        
        // Check if the clicked element has the "key" class
        const keyButton = e.target.closest('.key');
        if (keyButton) {
            wordleGame.handleInput(keyButton.dataset.key);
        }
    });
}

async function loadDatabase() {
    try {
        let response = await fetch('./database/quenya-english-words.json');
        wordsDatabase = await response.json();
        
        response = await fetch('./database/quenya-english-exercise-sentences.json');
        sentencesDatabase = await response.json();

        console.log("Database loaded. Total words: ", wordsDatabase.length);
        console.log("Total sentences: ", sentencesDatabase.length);

        const engine = new QueryEngine(wordsDatabase, sentencesDatabase);
        const quizEngine = new QuizEngine(engine);
        initUI(engine, quizEngine);

    } catch (error) {
        console.error("Failed to load database: ", error);
    }
}

loadDatabase();