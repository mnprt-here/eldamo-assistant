import builder
import json
from config import WORDS_JSON, SENTENCES_JSON

def smoke_test(word_to_check):
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        database = json.load(f)
        words = database['data']
    with open(SENTENCES_JSON, 'r', encoding='utf-8') as f:
        database = json.load(f)
        sentences = {s['id']: s for s in database['data']}

    # Find the word
    target = next((w for w in words if w['quenya'] == word_to_check), None)
    
    if not target:
        print(f"❌ Word '{word_to_check}' not found in database.")
        return

    print(f"✅ Found Word: {target['quenya']} ({target['english']})")
    print(f"🔗 Linked Sentences ({len(target['other-ids'])}):")
    
    for s_id in target['other-ids']:
        s = sentences.get(s_id)
        if s:
            print(f"   - {s['quenya']} -> {s['english']}")
    
if __name__ == "__main__":
    smoke_test('aiwë')