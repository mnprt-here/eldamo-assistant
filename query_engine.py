import json
import unicodedata
from typing import List, Dict, Any, Optional
from config import WORDS_JSON, SENTENCES_JSON

class QueryEngine:
    """
    Query Engine is used for data retrieval from JSON databse
    """
    def __init__(self, words_json_path: str, sentences_json_path: str):
        """
        Initializes the engine and loads the words and sentences from JSON database
        :param words_json_path: Path to the JSON file containing words
        :param sentences_json_path: Path to the JSON file containing sentences
        """
        # List of dictionaries with words and sentences
        _words = self._load_json(words_json_path)
        _sentences = self._load_json(sentences_json_path)

        # Make the List of dictionary of words (sentences) into dictionary of dictionary of words (sentences)
        # This will help get the items quicker by looking at item 'id' than searching through the List
        self.words: Dict[str, Dict[str, Any]] = {_w['id']: _w for _w in _words}
        self.sentences: Dict[str, Dict[str, Any]] = {_s['id']: _s for _s in _sentences}

    def _load_json(self, filepath: str, encoding: str = "utf-8") -> List[Dict[str, Any]]:
        """
        Reads the JSON files
        :param filepath: Path to the JSON file to be read
        :param encoding: Data encoding of the file
        """
        try:
            with open(filepath, encoding=encoding) as _file:
                database = json.load(_file)
                return database['data']
        except OSError as _e:
            print(f"Read Error: Could not access{filepath}. Systems says {_e}.")
            return []
    
    def _normalize_string(self, text: str) -> str:
        """
        Removes diacritics and lowercases the string for strict matching.
        :param text: String that needs to be removed from diacritics
        """
        if not text:
            return ''
        # Decompose characters (e.g., 'ö' becomes 'o' + '¨')
        nfd_form = unicodedata.normalize('NFD', text.lower())
        # Filter out the combining characters (the accents)
        return ''.join([c for c in nfd_form if not unicodedata.combining(c)])

    def get_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        """
        Quick access to the words and sentences if ids are known
        :param item_id: id of the query word or sentence
        """
        if item_id.startswith('w_'):
            return self.words.get(item_id)
        elif item_id.startswith('s_'):
            return self.sentences.get(item_id)
        else:
            print(f"Unknown id: {item_id}")
            return None

    def get_by_section(self, section_tag: str, target: str = 'both') -> List[Dict[str,  Any]]:
        """
        Returns all the words and sentences from the specific section or chapter.
        :param section_tag: The section identifier (e.g. '1.2.1')
        :param target: Which database to search ('words', 'sentences', 'both')
        """
        _results = []

        # Helper function for strictly left-aligned, dotted boundary matching
        def _is_match(link: str, tag: str) -> bool:
            return link == tag or link.startswith(f"{tag}.")

        # Search the words database
        if target in ['words', 'both']:
            for _w in self.words.values():
                if any(_is_match(_link, section_tag) for _link in _w.get('eldamo-link', [])):
                    _results.append(_w)
        
        # Search the sentences database
        if target in ['sentences', 'both']:
            for _s in self.sentences.values():
                if any(_is_match(_link, section_tag) for _link in _s.get('eldamo-link', [])):
                    _results.append(_s)
        
        return _results

    def get_linked_items(self, item_id: str) -> List[str]:
        """
        Returns the ids of sentences which contain the word with item_id, and vice-versa
        :param item_id: id of the query word or sentence
        """
        _item = self.get_by_id(item_id)
        if _item is None:
            print(f"No item detected with id: {item_id}")
            return None
        else:
            return _item.get('other-ids', [])

    def search(self, query: str, language: str) -> List[Dict[str, Any]]:
        """
        Returns the complete detail of the query word from the database. The diacritics are
        not necessary
        :param query: The query word, which must be in its regular form, no aorist/prefix/suffix
        :param language: Is it a 'Quenya' or an 'English' word?
        """
        _results = []
        # Remove diacritic from the string
        query = self._normalize_string(query)
        language = language.lower()

        for _item in self.words.values():
            # Remove diacritic and do an exact match
            _normalized_db_word = self._normalize_string(_item.get(language, ''))
            if query == _normalized_db_word:
                _results.append(_item)
        return _results
    
if __name__ == '__main__':
    query_engine = QueryEngine(WORDS_JSON, SENTENCES_JSON)
    result = query_engine.search('aiwe', 'quenya')
    for word in result:
        sentences_id = query_engine.get_linked_items(word['id'])
        for s_id in sentences_id:
            s = query_engine.get_by_id(s_id)
            print(f"{s['quenya']} -> {s['english']}")
    