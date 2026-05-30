import sys
from typing import List, Dict, Any
from query_engine import QueryEngine
from quiz_engine import QuizEngine
from config import WORDS_JSON, SENTENCES_JSON

def display_word_details(engine: QueryEngine, word_data: Dict[str, Any]):
    """Formats and prints the full details of a single word, including linked sentences."""
    # Print the core word details
    print(f"\n{'='*40}")
    print(f" Quenya:  {word_data.get('quenya', 'N/A')}")
    print(f" English: {word_data.get('english', 'N/A')}")
    
    # Handle the type list safely
    word_types = word_data.get('type', [])
    if isinstance(word_types, list):
        print(f" Type:    {', '.join(word_types)}")
    else:
        print(f" Type:    {word_types}")
        
    print(f" ID:      {word_data.get('id', 'N/A')}")
    print(f"{'-'*40}")

    # Fetch and print linked sentences
    linked_ids = engine.get_linked_items(word_data.get('id', ''))
    
    if linked_ids:
        print(" Example Sentences:")
        for s_id in linked_ids:
            sentence = engine.get_by_id(s_id)
            if sentence:
                print(f"  • {sentence.get('quenya', 'N/A')}")
                print(f"    ↳ {sentence.get('english', 'N/A')}")
    else:
        print(" No example sentences found for this word.")
    print(f"{'='*40}\n")

def display_test(test: List[Dict[str, Any]]):
    print(f"\n{'='*40}")
    print("\nTranslate the following sentences:")
    for _ind, _item in enumerate(test, 1):
        print(f"{_ind:>4}: {_item.get('quenya', '')}")
    print(f"{'='*40}\n")
        
def display_test_solved(test: List[Dict[str, Any]]):
    print(f"\n{'='*40}")
    print("\nTranslate the following sentences:")
    for _ind, _item in enumerate(test, 1):
        print(f"{_ind:>4}: {_item.get('quenya', 'N/A')}")
        print(f"    ↳ {_item.get('english', 'N/A')}\n")
    print(f"{'='*40}\n")

def main():
    print("Loading the Eldamo Assistant Database...")
    engine = QueryEngine(WORDS_JSON, SENTENCES_JSON)
    print("Databse loaded successfully.")
    tester = QuizEngine(engine)

    while True:
        # The main menu loop
        print("=== Eldamo CLI Menu ===")
        print("1. Search by Quenya word")
        print("2. Search by English word")
        print("3. Revise a Section/Chapter")
        print("4. Take a quiz")
        print("0. Exit")
        
        choice = input("\nSelect an option (0-4): ").strip()
        
        if choice == '0':
            print("Namárië! (Farewell!)")
            sys.exit(0)
            
        elif choice in ['1', '2']:
            language = "quenya" if choice == '1' else "english"
            query = input(f"\nEnter the {language} word to search for: ").strip()
            
            if not query:
                print("Search query cannot be empty.")
                continue
                
            # Use the engine to find the results
            results = engine.search(query, language)
            
            if not results:
                print(f"\nNo results found for '{query}'.\n")
            else:
                print(f"\nFound {len(results)} result(s):")
                for result in results:
                    display_word_details(engine, result)
        
        elif choice == '3':
            print("\n--- Revision Mode ---")
            print("A. Vocabulary (Words)")
            print("B. Exercises (Sentences)")

            rev_choice = input("Select revision type (A/B): ").strip().upper()

            if rev_choice == 'A':
                section = input("\nEnter the vocabulary section or chapter tag (e.g., 1.2.2, or 1): ").strip()
                results = engine.get_by_section(section, target='words')
                
                if not results:
                    print(f"\nNo words found for section '{section}'.\n")
                else:
                    print(f"\n--- Vocabulary: Section {section} ({len(results)} words) ---")
                    for i, word in enumerate(results, 1):
                        q_word = word.get('quenya', 'N/A')
                        e_word = word.get('english', 'N/A')
                        print(f"{i:>2}. {q_word} - {e_word}")
                    print("-" * 40 + "\n")

            elif rev_choice == 'B':
                section = input("\nEnter the exercise tag (e.g., 1.1, or 1.2): ").strip()
                results = engine.get_by_section(section, target='sentences')
                
                if not results:
                    print(f"\nNo sentences found for exercise '{section}'.\n")
                else:
                    print(f"\n--- Exercises: Section {section} ({len(results)} sentences) ---")
                    for i, sentence in enumerate(results, 1):
                        q_sent = sentence.get('quenya', 'N/A')
                        e_sent = sentence.get('english', 'N/A')
                        print(f"{i:>2}. {q_sent}")
                        print(f"    ↳ {e_sent}")
                    print("-" * 40 + "\n")
            else:
                print("Invalid choice. Returning to main menu.\n")
        elif choice == '4':
            print("\n--- Test Mode ---")
            print("A. Vocabulary Quiz (Words)")
            print("B. Translation Quiz (Sentences)")
            test_choice = input("Select test type (A/B): ").strip().upper()

            if test_choice == 'A':
                tester.set_data_type('words')
                print("\nWhich sections do you want to test? \nSeperate different sections by comma if more than one.")
                sections = [_s.strip() for _s in input("\nEnter the sections (e.g., 1.2.2, 1.2.5, 2): ").split(',')]
                tester.set_sections(sections)
            elif test_choice == 'B':
                tester.set_data_type('sentences')
                print("\nWhich sections do you want to test? \nSeperate different sections by comma if more than one.")
                sections = [_s.strip() for _s in input("\nEnter the sections (e.g., 1.2, 1.5, 2.3): ").split(',')]
                tester.set_sections(sections)
            else:
                print("Invalid choice. Returning to main menu\n")
            
            limit_input = input("\nHow many max questions do you want? (Press Enter for all): ").strip()
            if not limit_input:
                tester.set_limiter(0)
            else:
                try:
                    tester.set_limiter(int(limit_input))
                except ValueError:
                    print("  [Invalid number entered. Defaulting to all questions.]")
                    tester.set_limiter(0)
            mode = input("\nDo you want to randomize the order? (y/n): ")
            if mode == 'y':
                tester.set_mode('random')
            else:
                tester.set_mode('ordered')
            # Generate the appropriate quiz
            print("\nGenerating the test...")
            test = tester.generate_quiz()
            if test:
                display_test(test)
                input("\nWhen you are finished, press any key to reveal the answers...")
                display_test_solved(test)
            else:
                print("\nNo material found for the selected options")
            input("\nPress any key to go back to the main menu...")
        else:
            print("\nInvalid choice. Returning to the main menu.\n")

if __name__ == '__main__':
    main()