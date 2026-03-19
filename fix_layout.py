import sys
sys.stdout.reconfigure(encoding='utf-8')

# cp1252 special range mapping
cp1252_reverse = {
    '\u20ac': 0x80, '\u0081': 0x81, '\u201a': 0x82, '\u0192': 0x83,
    '\u201e': 0x84, '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87,
    '\u02c6': 0x88, '\u2030': 0x89, '\u0160': 0x8a, '\u2039': 0x8b,
    '\u0152': 0x8c, '\u008d': 0x8d, '\u017d': 0x8e, '\u008f': 0x8f,
    '\u0090': 0x90, '\u2018': 0x91, '\u2019': 0x92, '\u201c': 0x93,
    '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
    '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b,
    '\u0153': 0x9c, '\u009d': 0x9d, '\u017e': 0x9e, '\u0178': 0x9f,
}

def char_to_cp1252_byte(ch):
    code = ord(ch)
    if code <= 0x7f or (0xa0 <= code <= 0xff):
        return code
    return cp1252_reverse.get(ch)

def fix_mojibake_string(s):
    bytes_list = []
    for ch in s:
        b = char_to_cp1252_byte(ch)
        if b is None:
            return None
        bytes_list.append(b)
    try:
        return bytes(bytes_list).decode('utf-8')
    except:
        return None

def fix_all_mojibake(text):
    result = []
    i = 0
    while i < len(text):
        j = i
        buf = []
        while j < len(text):
            ch = text[j]
            b = char_to_cp1252_byte(ch)
            if b is not None and ord(ch) > 0x7f:
                buf.append(ch)
                j += 1
            else:
                break
        if len(buf) >= 3:
            s = ''.join(buf)
            fixed = fix_mojibake_string(s)
            if fixed and len(fixed) > 0 and ord(fixed[0]) >= 0x1780 and ord(fixed[0]) <= 0x17FF:
                print(f'Fixed: {repr(s[:8])} -> {fixed}')
                result.append(fixed)
                i = j
                continue
        result.append(text[i])
        i += 1
    return ''.join(result)

files = [
    r'd:\Hybrid project\pos_restaurant\src\app\management\page.tsx',
    r'd:\Hybrid project\pos_restaurant\src\components\management\CategoryModal.tsx',
    r'd:\Hybrid project\pos_restaurant\src\components\management\ProductModal.tsx',
    r'd:\Hybrid project\pos_restaurant\src\components\management\UserModal.tsx',
    r'd:\Hybrid project\pos_restaurant\src\components\pos\ProductGrid.tsx',
]
for filepath in files:
    print(f'--- {filepath} ---')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    fixed = fix_all_mojibake(content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fixed)
print('Done!')
