from query_engine import QueryEngine
from typing import List
import random
from config import WORD_TYPES

class QuizEngine:
    """
    Quiz Engine is used to create mock tests from the database.
    The user has the option to select specific section/chapter.
    The generated questions can be limited, and either ordered or randomized.
    """
    def __init__(self, database_engine: QueryEngine):
        """
        Initializes the engine
        :param database_engine: The QueryEngine is used to retrieve data
        """
        self.db = database_engine
        self.current_quiz_items = []
        # Default test is from the whole chapter 1
        self.sections = ['1']
        # Default test only uses sentences
        self.data_type = 'sentences'
        # Empty word_types chooses all words for the test
        self.word_types = []
        # max_num set to 0 means generate all possible questions
        self.max_num = 0
        # mode of the quiz -> random, ordered
        self.mode = 'ordered'
    
    def set_sections(self, section_tag_list: List[str]):
        """
        Forces the engine to generate quiz from the selected sections
        :param section_tag: eldamo-link of the required section
        """
        if section_tag_list:
            self.sections = section_tag_list
        else:
            print(f"Invalid list. Reverting to default: {self.sections}")
            return

        # 1. Clean the input: strip spaces and remove exact string duplicates
        _cleaned_tags = list({_stripped for _s in section_tag_list if (_stripped := _s.strip())})
        
        # 2. Sort by length so we process parents (shorter) before children (longer)
        _cleaned_tags.sort(key=len)
        
        _optimized_sections = []
        for _tag in _cleaned_tags:
            # Check if this tag is a child of any parent tag we already approved
            # Example: If '1.2' is in _optimized_sections, '1.2.2'.startswith('1.2.') is True
            is_redundant = any(_tag.startswith(f"{_parent}.") for _parent in _optimized_sections)
            
            if not is_redundant:
                _optimized_sections.append(_tag)
                
        self.sections = _optimized_sections
        
        # Optional: Let the user know the engine optimized their input
        if len(_cleaned_tags) != len(self.sections):
            print(f"  [Optimized redundant tags. Setting test sections to: {', '.join(self.sections)}]")

    def set_limiter(self, max_num: int):
        """
        Sets a limit on the maximum number of questions that can be generated
        """
        if max_num < 0:
            print(f"Invalid choice.")
            return
        self.max_num = max_num
    
    def set_data_type(self, data_type: str):
        """
        Which data should be used to create the test? -> words, sentences, both
        """
        if data_type in ["words", "sentences"]:
            self.data_type = data_type
        else:
            print(f"Invalid data choice: {data_type}")
    
    def set_word_type(self, word_type_list: List[str]):
        """
        Which types of words should be used to create the test?
            -> n (noun), v (verb), pron (pronoun), adj (adjective), adv (adverb), suf (suffix), prep (preposition)
               conj (conjunction)
        """
        self.word_types = word_type_list
    
    def set_mode(self, mode: str):
        """
        Set the mode of the quiz -> random, ordered
        """
        if mode in ['random', 'ordered']:
            self.mode = mode
        else:
            print(f"Invalid mode: {mode}")
    
    def generate_quiz(self):
        """
        Generates the quiz
        """
        # Clean the previous quiz items
        self.current_quiz_items = []

        for section in self.sections:
            self.current_quiz_items += self.db.get_by_section(section, self.data_type)
        
        if self.data_type == 'words' and self.word_types:
            _common = set(self.word_types) & set(WORD_TYPES)
            if _common:
                self.current_quiz_items = [
                    w for w in self.current_quiz_items 
                    if w.get('type') in _common
                ]

        # If no data is found, test generation fails
        if not self.current_quiz_items:
            print(f"No appropriate data found")
            return []
        
        # Set the correct max number of questions that can be generated
        _current_quiz_len = len(self.current_quiz_items)
        actual_max = self.max_num
        if (actual_max == 0) or (actual_max > _current_quiz_len):
            actual_max = _current_quiz_len
        # Choose the mode and return the generated quiz
        if self.mode == 'random':
            return random.sample(self.current_quiz_items, actual_max)
        else:
            return self.current_quiz_items[:actual_max]