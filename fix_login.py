import sys
sys.stdout.reconfigure(encoding='utf-8')
filepath = r'd:\Hybrid project\pos_restaurant\src\app\login\page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# cp1252 reverse mapping: Unicode char -> byte (for 0x80-0x9F range)
# Latin-1 chars (U+00xx) map directly: ord(ch) -> byte
# cp1252 special range:
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
    """Get the cp1252 byte value for a character."""
    code = ord(ch)
    if code <= 0x7f or (0xa0 <= code <= 0xff):
        return code  # Direct Latin-1 mapping
    if ch in cp1252_reverse:
        return cp1252_reverse[ch]
    return None

def fix_mojibake_string(s):
    """Convert cp1252-mojibake string back to original UTF-8 text."""
    bytes_list = []
    for ch in s:
        b = char_to_cp1252_byte(ch)
        if b is None:
            return None  # Can't convert this char
        bytes_list.append(b)
    try:
        return bytes(bytes_list).decode('utf-8')
    except:
        return None

# Fix known corrupted regions by scanning for contiguous segments
# that are all cp1252-encodable and decode to Khmer (U+1780-U+17FF block)
def fix_all_mojibake(text):
    result = []
    i = 0
    while i < len(text):
        # Try to build a cp1252-encodable sequence of at least 3 chars
        j = i
        buf = []
        while j < len(text):
            ch = text[j]
            b = char_to_cp1252_byte(ch)
            if b is not None and ord(ch) > 0x7f:  # Non-ASCII, could be mojibake
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

fixed_content = fix_all_mojibake(content)

# Also fix placeholder and warning icon (non-Khmer corrupted strings)
# bullet • = U+2022, in cp1252 = 0x95
# â€¢ = corrupted from cp1252: â = 0xE2 (not cp1252 direct...), wait
# Actually â€¢ represents the UTF-8 bytes E2 80 95 of U+2022 (•) decoded as Latin-1:
# E2 -> â (U+00E2), 80 -> after re-encoding lost... let me check
# In the file we have 'â€¢' which is chars: â (U+00E2), € (U+20AC), ¢ (U+00A2)
# cp1252: â = 0xE2, € = 0x80, ¢ = 0xA2
# bytes: E2 80 A2 = UTF-8 for U+20A2 (not bullet)
# Actually • U+2022 in UTF-8 = E2 80 A2? No: E2 80 A2 is private use...
# U+2022 • UTF-8 = E2 80 A2? Let me check: U+2022 = 0x2022
# UTF-8 encoding: 0x2022 = 0010 0000 0010 0010
# 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
# 1110 0010 10000000 10100010 = E2 80 A2
# So U+2022 (bullet •) UTF-8 = E2 80 A2 = bytes [226, 128, 162]
# When those 3 bytes are read as cp1252: E2 -> â (0xE2 = â in Latin-1)
# 80 -> € (0x80 = € in cp1252)
# A2 -> ¢ (0xA2 = ¢ in Latin-1)
# So the corrupted bullet is: â€¢ (a-circumflex, euro sign, cent sign)

# Warning ⚠ = U+26A0, UTF-8 = E2 9A A0 = bytes [226, 154, 160]
# E2 -> â, 9A -> š (cp1252 0x9A), A0 -> (non-breaking space U+00A0 = byte 0xA0 in Latin-1)
# Wait: byte 0xA0 in Latin-1 = U+00A0 (non-breaking space)
# Actually in the file we saw '<span>âš </span>' where the space after š might be U+00A0

# Let's handle placeholder separately
# placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" 
# Each â€¢ = U+00E2 U+20AC U+00A2 -> bytes E2 80 A2 -> U+2022 (•)
# 8 bullets = 8 repetitions
bullet_corrupted = '\u00e2\u20ac\u00a2'
bullet_fixed = '\u2022'  # •
fixed_content = fixed_content.replace(
    f'placeholder="{bullet_corrupted * 8}"',
    'placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"'
)

# Warning icon: âš  (could be followed by non-breaking space or regular space)
# U+26A0 ⚠ UTF-8 = E2 9A A0 = 
# E2 -> â (0xE2), 9A -> š (cp1252 0x9A = U+0161), A0 -> non-breaking space (0xA0 = U+00A0)
warn_corrupted = '\u00e2\u0161\u00a0'  # â š (nbsp)
# Actually let's check what's in the file right before </span>
idx_warn = fixed_content.find('<span>')
if idx_warn >= 0:
    print('Span content:', repr(fixed_content[idx_warn:idx_warn+20]))
    fixed_content = fixed_content.replace(
        '<span>' + warn_corrupted + '</span>',
        '<AlertTriangle size={13} strokeWidth={2.5} />'
    )
    # Also try without the specific chars - look for the pattern
    idx_warn2 = fixed_content.find('<span>')
    if idx_warn2 >= 0:
        end = fixed_content.find('</span>', idx_warn2)
        span_inner = fixed_content[idx_warn2+6:end]
        print('Remaining span inner:', repr(span_inner))
        # Try to fix it with mojibake
        fixed_inner = fix_mojibake_string(span_inner.strip())
        if fixed_inner:
            print('Fixed span inner:', repr(fixed_inner), '->', fixed_inner)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(fixed_content)
print('Done!')



