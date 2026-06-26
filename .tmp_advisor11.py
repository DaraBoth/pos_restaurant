import json, urllib.request, sys, subprocess
sys.stdout.reconfigure(encoding='utf-8')

key_proc = subprocess.run(
    ['grep','ORBIT_API_KEY','D:/Hybrid project/pos_restaurant/.env'],
    capture_output=True, text=True)
key = key_proc.stdout.strip().split('=',1)[1].strip()
url = 'https://dailygoalmap.vercel.app/api/mcp'

def post(payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, method='POST')
    req.add_header('Content-Type','application/json; charset=utf-8')
    req.add_header('X-Project-Api-Key', key)
    with urllib.request.urlopen(req, body) as resp:
        return json.load(resp)

new_tasks = [
    (
        'Translate Order History and Daily Report page: full Khmer i18n sweep (supersedes 4374f6ce)',
        'Source: advisor audit (d80b41cb). Supersedes narrower task 4374f6ce (tab buttons only) -- '
        'this covers the entire page.\n\n'
        'Context: src/app/history/page.tsx -- every visible string is a raw English literal. '
        'useLanguage is likely imported but t() is never called. A Khmer cashier closing the daily '
        'report sees a completely English interface.\n\n'
        'Acceptance criteria -- translate ALL of the following to bilingual t() calls:\n'
        '1. Tab buttons: "Order History", "Close Daily Report", "Report History"\n'
        '2. Section headers: "Daily Sales Closing", "Todays Sales Summary", "Todays Expenses"\n'
        '3. Table headers: "Report Date", "Paid Orders", "Total Sales", "Paid Receipts"\n'
        '4. Empty state: "No paid receipts for selected date."\n'
        '5. Action buttons: "PRINT", "+ Add Expense", "Print Preview", "Print Master Receipt"\n'
        '6. Row labels: "Round 1", "Round 2", "Order Segment"\n'
        '7. Status labels: "Status: CLOSED", "Status: OPEN"\n'
        '8. EXPENSE_CATEGORIES dropdown: "Inventory", "Utility", "Transportation", '
        '"Maintenance", "Salary", "Equipment", "Other"\n'
        '9. Any remaining hardcoded strings found during audit\n\n'
        'Pattern: import useLanguage, call const { t } = useLanguage(), wrap every string in t(). '
        'Add all new keys to src/lib/i18n.ts with both en and km values.\n\n'
        'Note: after this task is done, task 4374f6ce (tab buttons) can be closed as superseded.\n\n'
        'Files: src/app/history/page.tsx, src/lib/i18n.ts',
        ['project:dineos','assign:coder','wf:coder-task']
    ),
    (
        'Translate CheckoutModal 3 hardcoded labels: Cash USD Received, Remaining via, Saving amount',
        'Source: advisor audit (87fd24e1).\n\n'
        'Context: src/components/pos/CheckoutModal.tsx -- three high-visibility strings during every '
        'payment transaction are hardcoded English with no t() call:\n'
        '- Line 399: "Cash USD Received" -- the main cash input label, seen every transaction\n'
        '- Line 433: "Remaining via CASH/KHQR/CARD" -- dynamic label showing amount still owed\n'
        '- Line 296: "Saving [amount]" -- discount confirmation badge\n\n'
        'Acceptance criteria:\n'
        '1. Line 399: wrap in t("cashUsdReceived"). '
        'Add key: en "Cash USD Received" / km "ទទួលបានជាដុល្លារ"\n'
        '2. Line 433: the "Remaining via" prefix should use t("remainingVia"). '
        'The payment method name that follows can stay as-is or also be translated. '
        'Add key: en "Remaining via" / km "នៅសល់តាម"\n'
        '3. Line 296: "Saving" should use t("saving"). '
        'Add key: en "Saving" / km "សន្សំ"\n'
        '4. While in this file, do a quick scan for any other hardcoded strings and fix them too.\n'
        '5. No logic changes -- translation only.\n\n'
        'Files: src/components/pos/CheckoutModal.tsx, src/lib/i18n.ts',
        ['project:dineos','assign:coder','wf:coder-task']
    ),
    (
        'Translate input placeholder text to Khmer across POS and management screens (15+ fields)',
        'Source: advisor audit (dac3c111). Login placeholder covered separately; '
        'HoldPaymentModal "Optional" covered by c13c945c.\n\n'
        'Context: Input fields show hardcoded English placeholders regardless of language setting. '
        'Every day these placeholders are visible to Khmer staff who cannot read them.\n\n'
        'Locations to fix (English placeholder -> Khmer translation):\n'
        '1. src/components/pos/FloorPlanView.tsx line 285: '
        '"Search table..." -> t("searchTable") / "ស្វែងរកតុ..."\n'
        '2. src/app/management/inventory/page.tsx ~line 155: '
        '"Search..." -> t("search") or t("searchIngredient")\n'
        '3. src/app/management/inventory/page.tsx ~line 338 (InventoryItemModal): '
        '"Milk, Coffee Beans, Vodka..." example placeholder -> t("ingredientNamePlaceholder") '
        '/ "ទឹកដោះគោ, គ្រាប់កាហ្វេ..."\n'
        '4. src/app/management/tables/page.tsx ~line 170: '
        '"Custom zone..." -> t("customZone") / "តំបន់ផ្ទាល់ខ្លួន..."\n'
        '5. src/components/management/InventoryItemModal.tsx: '
        '"e.g. Jasmine Rice" -> t("stockItemNamePlaceholder") / "ឧទា. អង្ករម្លិះ"\n'
        '   "kg" unit placeholder -> t("unitPlaceholder") / "គីឡូ"\n'
        '6. Search fields in management pages (users, products, categories) that show '
        '"Search..." in English -- audit and translate.\n'
        '7. Any other placeholder found during the audit that is hardcoded English.\n\n'
        'Pattern: replace placeholder="English text" with placeholder={t("key")} '
        'and add the key to src/lib/i18n.ts.\n\n'
        'Files: src/components/pos/FloorPlanView.tsx, src/app/management/inventory/page.tsx, '
        'src/app/management/tables/page.tsx, src/components/management/InventoryItemModal.tsx, '
        'and any other management pages found during audit, src/lib/i18n.ts',
        ['project:dineos','assign:coder','wf:coder-task']
    ),
    (
        'Order History: add filter by cashier and by payment method for owner reconciliation',
        'Source: advisor audit (b50046b7).\n\n'
        'Context: src/app/history/page.tsx Order History tab filters by date range and status only. '
        'The search placeholder says "Search by date, cashier, status..." but no cashier/payment '
        'search is actually wired up. The owner cannot quickly answer: how much cash did cashier '
        'Dara collect today? or how much was paid via KHQR this week?\n\n'
        'Acceptance criteria:\n'
        '1. Add a Cashier dropdown filter to the Order History toolbar:\n'
        '   - Fetches distinct cashier names from orders in the selected date range for this restaurant.\n'
        '   - Option "All Cashiers / គ្រប់ការគ្រប់គ្រង" as default.\n'
        '   - Selecting a cashier filters the order list to show only their orders.\n'
        '2. Add a Payment Method dropdown filter:\n'
        '   - Options: All, Cash USD, Cash KHR, KHQR, Card.\n'
        '   - Filters orders where any payment in the payments table matches the selected method.\n'
        '3. Both filters combine with the existing date range and status filters (AND logic).\n'
        '4. Wire up the existing search input (currently not connected to order list search) to '
        'filter by: order ID, customer name, table name, or receipt number -- whichever fields '
        'are available on the order.\n'
        '5. Show filter result count: "Showing 14 of 47 orders" when filters are active.\n'
        '6. The Rust get_orders command may need new optional filter parameters: '
        'cashier_name: Option<String>, payment_method: Option<String>. '
        'Or apply these as client-side filters if the full list is already loaded.\n'
        '7. i18n: add filterByCashier, filterByPayment, allCashiers, showingXofY keys (en+km).\n\n'
        'Files: src/app/history/page.tsx, src-tauri/src/commands/orders.rs (if server-side filter), '
        'src/lib/api/orders.ts, src/lib/i18n.ts',
        ['project:dineos','assign:coder','wf:coder-task']
    ),
    (
        'Update window title to show restaurant name and increase minimum window size for touchscreens',
        'Source: advisor audit (55743b79).\n\n'
        'Context: Two separate issues in tauri.conf.json and Rust startup:\n'
        '1. Window title: tauri.conf.json line 15 hardcodes "DineOS - POS System". '
        'Khmer-language staff cannot identify the app in the taskbar. If the owner named '
        'their shop "Volt Coffee", the taskbar still says "DineOS".\n'
        '2. Minimum window size: the current minimum may be too small for touchscreen POS terminals '
        'where the target is 1280x800 or larger.\n\n'
        'Acceptance criteria:\n'
        '1. Dynamic window title: after successful login, set the window title to '
        '"[Restaurant Name] - DineOS" using Tauri\'s window title API from Rust.\n'
        '   - In the login command or after restaurant data is loaded, call: '
        '     app_handle.get_webview_window("main").unwrap().set_title(&format!("{} - DineOS", restaurant_name))\n'
        '   - Before login (on login screen): keep "DineOS" as the default.\n'
        '   - On logout: reset to "DineOS".\n'
        '2. Minimum window size: update tauri.conf.json minWidth/minHeight from current values to '
        '1024x680 (ensures the POS sidebar cart + product grid fit without horizontal scroll on '
        'standard touchscreen POS terminals). Do NOT increase to 1280 as that would block '
        'smaller laptop screens.\n'
        '3. The window title change requires no frontend changes -- it is purely in the Rust layer.\n\n'
        'Files: src-tauri/src/commands/auth.rs (set title after login), '
        'src-tauri/tauri.conf.json (min size), src-tauri/src/lib.rs (logout reset)',
        ['project:dineos','assign:coder','wf:coder-task']
    ),
]

print('Creating coder tasks:')
for title, desc, tags in new_tasks:
    r = post({'tool':'tasks.create','input':{'title':title,'description':desc,'tags':tags}})
    t = r.get('result',{}).get('task',{})
    print(t.get('id','ERR')[:8], '|', t.get('title','')[:70])

# Complete all 6 advisor tasks (including the 1 duplicate ac1502e2)
ids_short = ['d80b41cb','ac1502e2','87fd24e1','dac3c111','b50046b7','55743b79']
body = json.dumps({"tool":"tasks.list","input":{"tags":["assign:advisor","assign:advisor-agent"],"match":"any","completed":False,"limit":20}}).encode()
req2 = urllib.request.Request(url, method='POST')
req2.add_header('Content-Type','application/json')
req2.add_header('X-Project-Api-Key', key)
with urllib.request.urlopen(req2, body) as resp2:
    r2 = json.load(resp2)
all_tasks = r2.get('result',{}).get('tasks',[])
full_ids = [t['id'] for t in all_tasks if any(t['id'].startswith(s) for s in ids_short)]

print(f'\nCompleting {len(full_ids)} advisor tasks:')
for tid in full_ids:
    rc = post({'tool':'tasks.complete','input':{'task_id':tid}})
    print(' ', tid[:8], 'ok' if rc.get('ok') else 'ERR')

body3 = json.dumps({"tool":"tasks.list","input":{"tags":["assign:advisor","assign:advisor-agent"],"match":"any","completed":False,"limit":5}}).encode()
req3 = urllib.request.Request(url, method='POST')
req3.add_header('Content-Type','application/json')
req3.add_header('X-Project-Api-Key', key)
with urllib.request.urlopen(req3, body3) as resp3:
    rc3 = json.load(resp3)
print('Remaining open advisor tasks:', len(rc3.get('result',{}).get('tasks',[])))
