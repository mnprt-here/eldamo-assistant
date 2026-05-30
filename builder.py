import csv
import json
import hashlib
from config import WORDS_CSV, WORDS_JSON, SENTENCES_CSV, SENTENCES_JSON

def build(input_file, output_file, prefix, registry=None):
    """
    build reads the input_file and generates a polished output_file
    :param input_file: A CSV file containing readable data in required format
    :param output_file: A JSON file to which the polished data is written
    :param prefix: Used to differentiate the unique data ids between different data types
    :param registry: Used to check any duplication of id's
    """
    _polished_data = []
    if registry is None:
        registry = {}
    
    try:
        # Read the CSV file
        with open(input_file, mode="r", encoding="utf-8-sig") as _file:
            _reader = csv.DictReader(_file)
            for _row in _reader:
                # Clean the word types: 'adj, adv' -> ['adj', 'adv']
                if 'type' in _row:
                    _type_list = [_type.strip() for _type in _row['type'].split(',')]
                else:
                    _type_list = []
                if 'word-keys' in _row:
                    _keys = [_words.strip() for _words in _row['word-keys'].split(',')]
                else:
                    _keys = []
                
                # Each data entry in the JSON file with desired format 
                # id: a unique identifier for each word or sentence, hashlib.md5(row['quenya'].encode()).hexdigest()[:8]
                # other-ids: to cross-connect words and sentences

                # Assign a unique hash id to the data
                _raw_id = f"{_row['quenya']}{_row['english']}"
                # Covert it to hash, and truncate the id to save memory
                _hash = hashlib.md5(_raw_id.encode("utf-8")).hexdigest()[:8]
                # Prefix is used to differentiate between words and sentences
                _id = f"{prefix}_{_hash}"
                # Check for a duplicate id's
                if _id in registry:
                    _existing_entry = registry[_id]
                    # IMPORTANT: CSV data entry must have only one eldamo-link for each entry
                    # IF in future, the CSV eldamo-link has comma-seperated values, change this:
                    _new_link = _row['eldamo-link']
                    if _new_link not in _existing_entry['eldamo-link']:
                        _existing_entry['eldamo-link'].append(_new_link)
                else:
                    _data_entry = {
                        'id': _id,
                        'quenya': _row['quenya'],
                        'english': _row['english'],
                        'type': _type_list,
                        'eldamo-link': [_row['eldamo-link']],
                        'other-links': [],
                        'word-keys': _keys,
                        'other-ids': []
                    }
                    _polished_data.append(_data_entry)
                    registry[_id] = _data_entry
        try:
            # Create the corresponding JSON file with polished data
            with open(output_file, 'w', encoding='utf-8') as _file:
                json.dump(_polished_data, _file, indent=4, ensure_ascii=False)
            
            print(f"{len(_polished_data)} entries processed into the {output_file}.")
        except OSError as _e:
            print(f"Write error: Could not create the file {output_file}. System says {_e}.")
    except FileNotFoundError:
        print(f"Could not find the file {input_file}. Check your path.")
    except OSError as _e:
        print(f"Read Error: Could not access {input_file}. System says {_e}.")

def link(words_json, sentences_json, word_lookup):
    try:
        with open(words_json, "r", encoding="utf-8") as _file:
            _words = json.load(_file)
        with open(sentences_json, "r", encoding="utf-8") as _file:
            _sentences = json.load(_file)
    except FileNotFoundError as _e:
        print(f"Linking error: {_e}")
        return
    
    # List of sentence-ids to connect to words
    _backlinks = {_w['id']: [] for _w in _words}

    # Apply the work links to sentences
    for _s in _sentences:
        # Clean previously linked ids
        _s['other-ids'] = []
        for _key in _s.get('word-keys', []):
            _w_id = word_lookup.get(_key)
            if _w_id:
                _s['other-ids'].append(_w_id)
                if _w_id in _backlinks:
                    _backlinks[_w_id].append(_s['id'])
            else:
                print(f"Warning: Word-key '{_key}' found in sentence but not in words dictionary.")
    
    # Apply the backlinks to words
    for _w in _words:
        _w['other-ids'] = _backlinks.get(_w['id'], [])

    # Write the linked data to the JSON files
    try:
        with open(words_json, 'w', encoding='utf-8') as _file:
            json.dump(_words, _file, indent=4, ensure_ascii=False)
        with open(sentences_json, 'w', encoding='utf-8') as _file:
            json.dump(_sentences, _file, indent=4, ensure_ascii=False)
        print(f"Linking {words_json} and {sentences_json} successfully completed.")
    except OSError as _e:
            print(f"Linking error: System says {_e}.")

def run(words_csv, words_json, sentences_csv, sentences_json, link = False):
    master_registry = {}
    build(words_csv, words_json, "w", master_registry)
    build(sentences_csv, sentences_json, "s", master_registry)

    if link:
        word_lookup = {quenya: _id for _id, quenya in master_registry.items() if _id.startswith('w_')}
        link(words_json, sentences_json, word_lookup)
    else:
        print("Words and sentences are not linked.")

if __name__ == "__main__":
    run(WORDS_CSV, WORDS_JSON, SENTENCES_CSV, SENTENCES_JSON)