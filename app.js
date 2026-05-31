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
     * @param {string} text - String that needs to be removed from diacritics
     * @returns string with diacritics removed
     */
    normalizeString(text) {
        if (!text) return "";
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * Quick access to the words and sentences if ids are known
     * @param {string} itemId - id of the query word or sentence
     * @returns word or sentence of the given id
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
     * @param {string} sectionTag - The section identifier (e.g. '1.2.1')
     * @param {string} target - Which database to search ('words', 'sentences', 'both'). Defaults to 'both'.
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
     * @param {string} itemId - id of the query word or sentence 
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
     * @param {string} query - word to search for, diacritics are not necessary
     * @param {string} language - which language to serach in: quenya, or english
     * @returns complete detail of the query word or sentence 
     */
    search(query, language) {
        const results = [];
        query = this.normalizeString(query);
        language = language.toLowerCase();

        for (const word of Object.values(this.words)) {
            const normalizedWord = this.normalizeString(word[language] || '');
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
        'Quiz': document.getElementById('quiz')
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