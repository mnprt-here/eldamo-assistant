import json
import hashlib
import bs4
import re

uiLabel = 'Neo-Quenya'
search_key = 'quenya'
language_id = 'nq'
html_data_file   = f"./database/words-{language_id}.html"
json_output_file = re.sub(r'.html$', '.json', html_data_file)

with open(html_data_file, "r", encoding='utf-8') as f:
    html_content = f.read()

soup = bs4.BeautifulSoup(html_content, 'html.parser')

words = soup.select('dt')
polished_data = {
    "meta" : {
        "languageID" : language_id,
        "uiLabel" : uiLabel,
        "searchKey" : search_key
    },
    "data" : []
}
# To get the English translation (always inside ""s)
pattern = r'[“"]([^”"]+)[”"]'
for dt in words:
    _span = dt.find('span')
    # If the first span is not primary, reject the word
    if _span and _span.get('class') == ['primary']:
        _i_tag = dt.find('i')
        _english = ""
        if _i_tag and _i_tag.next_sibling:
            _full_text = _i_tag.next_sibling.text
            # Separates English translation from other text
            _full_text_parts = re.split(pattern, _full_text)
            # English translation should always be at index 1 (WARNING: Unless Eldamo changes the data structure)
            if len(_full_text_parts) > 1:
                _english = _full_text_parts[1].strip()

                # Check if the word needs to be rejected
                _outer_text = "".join(_full_text_parts[0::2]).lower()
                if "see instead" in _outer_text or re.search(r'\bsee\b', _outer_text):
                    continue
            else:
                continue
        _lang = _span.text.strip()
        # If the word starts with a punctuation or digit or underscore, reject it
        if re.search(r'^[\W\d_]', _lang):
            continue
        
        # Remove the super/sub scripts
        # \d removes all standard and superscript/subscript numbers (1, 2, ¹, ², ₁)
        # \u2070-\u209F and \u00B2\u00B3\u00B9 catch any other weird Unicode sub/superscript blocks
        # \u1D00-\u1D7F catches phonetic superscript letters (like ⁿ)
        _lang = re.sub(r'[\d\u2070-\u209F\u00B2\u00B3\u00B9\u1D00-\u1D7F]+', '', _lang)
        _lang = re.sub(r'c','k', _lang)

        # Split word types with multiple types
        _word_type = _i_tag.text.strip().split(' and ') if _i_tag else ""

        # Assign a unique hash id to the data
        _raw_id = f"{_lang}{_english}"
        # Covert it to hash, and truncate the id to save memory
        _hash = hashlib.md5(_raw_id.encode("utf-8")).hexdigest()[:8]
        # Prefix is used to differentiate between words and sentences
        _id = f"w_{_hash}"

        # Append to the data
        polished_data['data'].append({
            'id': _id,
            search_key: _lang,
            'english': _english,
            'type': _word_type,
            'eldamo-link': [],
            'other-links': [],
            'word-keys': [],
            'other-ids': []
        })

with open(json_output_file, 'w', encoding='utf-8') as _file:
    json.dump(polished_data, _file, indent=4, ensure_ascii=False)