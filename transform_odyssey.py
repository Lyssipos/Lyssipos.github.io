import re
import random

def transform_line(line):
    # Remove trailing newline, preserve punctuation attached to words
    line = line.rstrip('\n')
    if not line.strip():
        return ''
    
    # Split into words (keeping punctuation attached)
    words = re.findall(r'\S+', line)
    if not words:
        return ''
    
    # Find subject word: first noun-like or pronoun (he/she/it/they/we/you/I/one/man/woman/god/etc.)
    # Simplified: first word that is not a verb, not an article, not a preposition? 
    # But rule: "if no subject word then use first verb"
    subjects = {'he', 'she', 'it', 'they', 'we', 'you', 'i', 'one', 'man', 'woman', 'god', 'goddess', 'fools', 'survivors', 'seasons', 'gods', 'recklessness', 'calypso', 'muse'}
    # Also any capitalized word (proper noun) can be subject
    subject_word = None
    verb_word = None
    
    for w in words:
        # Check if it's a subject pronoun, noun, or capitalized name
        w_clean = w.lower().strip(',.;:!?')
        if w_clean in subjects or (w[0].isupper() and w_clean not in {'the', 'a', 'an', 'and', 'of', 'to', 'for', 'with', 'by'}):
            subject_word = w
            break
        # Find first verb (simplistic: any word not obviously noun/proper? better: just track first word as fallback)
        if verb_word is None:
            verb_word = w
    
    # Choose first element: subject if exists, else first verb, else first word
    if subject_word:
        first = subject_word
        remaining = [w for w in words if w != subject_word]
    elif verb_word:
        first = verb_word
        remaining = [w for w in words if w != verb_word]
    else:
        first = words[0]
        remaining = words[1:]
    
    # Randomly rearrange the rest
    random.shuffle(remaining)
    
    # Reassemble
    return first + ' ' + ' '.join(remaining)

def process_file(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as infile:
        lines = infile.readlines()
    
    transformed_lines = [transform_line(line) for line in lines]
    
    with open(output_path, 'w', encoding='utf-8') as outfile:
        outfile.write('\n'.join(transformed_lines))
    
    print(f"Done! Output saved to {output_path}")

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3:
        print("Usage: python transform_odyssey.py Odyssey 500 pages.txt reassembled_odyssey.txt")
    else:
        process_file(sys.argv[1], sys.argv[2])
