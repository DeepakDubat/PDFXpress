"""
Personal PDF Password Recovery Tool
------------------------------------
Local-use tool: upload a password-protected PDF you own, and try to recover
its password using a wordlist (dictionary attack) via pikepdf.

Run: python3 pdf_password_tool.py
Then open http://127.0.0.1:5000 in your browser (LOCAL ONLY - do not deploy
this publicly, since it lets whoever has access run a password-cracking
job on any file they upload).
"""

from flask import Flask, request, render_template_string, send_file, jsonify
import pikepdf
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import product
import string
import subprocess
import warnings

warnings.filterwarnings("ignore")

app = Flask(__name__)

UPLOAD_PATH = "input.pdf"
OUTPUT_PATH = "output.pdf"
WORDLIST_PATH = "rockyou.txt"  # update this to your local wordlist path
MAX_WORKERS = 8  # Number of threads for parallel cracking

# Count total words in wordlist
def count_wordlist():
    """Count total entries in wordlist"""
    try:
        with open(WORDLIST_PATH, "r", encoding="latin-1", errors="ignore") as f:
            return sum(1 for _ in f)
    except:
        return 0

TOTAL_WORDS = count_wordlist()

# Shared state for progress across the single-user local session
state = {
    "status": "idle",       # idle | cracking | done | not_found | error
    "password": None,
    "log": [],
    "attempts": 0,
    "current_password": "",
    "total_words": TOTAL_WORDS,
    "percentage": 0,
    "crack_type": "wordlist",  # wordlist | pattern | rules
    "use_patterns": False,
    "use_rules": False,
    "threads_active": 0,
}


# ==================== PASSWORD GENERATION FUNCTIONS ====================

def apply_rules(password):
    """Generate password mutations using common rules"""
    variations = set([password])
    
    # Rule 1: Capitalize first letter
    if password:
        variations.add(password[0].upper() + password[1:])
    
    # Rule 2: All uppercase
    variations.add(password.upper())
    
    # Rule 3: Add common numbers at end
    for num in ["123", "1", "2023", "2024", "2025", "2026", "555", "666", "777", "888", "999"]:
        variations.add(password + num)
    
    # Rule 4: Common special chars
    for special in ["!", "@", "#", "$", "%", "&", "*", "!!", "!@#"]:
        variations.add(password + special)
    
    # Rule 5: Common replacements (leet speak)
    replacements = {
        'a': '@', 'e': '3', 'i': '!', 'o': '0', 's': '$', 'l': '1', 't': '7'
    }
    for old, new in replacements.items():
        variations.add(password.replace(old, new))
    
    # Rule 6: Add year prefix
    for year in ["2023", "2024", "2025", "2026"]:
        variations.add(year + password)
    
    return variations


def generate_patterns(base_patterns):
    """Generate passwords from patterns"""
    patterns = []
    
    # Pattern 0: Number sequences (0-9999)
    for i in range(10000):
        patterns.append(str(i).zfill(4))
    
    # Pattern 1: Simple number+special
    for num in range(100):
        for special in ['!', '@', '#', '$', '%']:
            patterns.append(f"pass{num}{special}")
    
    # Pattern 2: Word + number combinations
    common_words = ["admin", "user", "test", "demo", "pass", "secret", "welcome"]
    for word in common_words:
        for num in range(100):
            patterns.append(f"{word}{num}")
            patterns.append(f"{num}{word}")
    
    return patterns


# ==================== CRACKING FUNCTIONS ====================

def try_password(pdf_path, candidate):
    """Try a single password. Returns True if successful."""
    try:
        with pikepdf.open(pdf_path, password=candidate) as pdf:
            # Double-check by trying to access content
            try:
                # Try to get page count to validate password works
                _ = len(pdf.pages)
                return True  # Success!
            except:
                return False  # Can't access content
    except pikepdf.PasswordError:
        return False  # Wrong password
    except Exception as e:
        return False  # Other error, skip


def run_hashcat_worker(pdf_path, wordlist_path, hashcat_opts="-m 10500", use_wordlist=True, use_patterns=False, use_rules=False):
    """Run pdf2john and hashcat to leverage GPU cracking. Streams hashcat output to state['log']."""
    import shutil
    state["status"] = "cracking"
    state["log"] = []
    state["attempts"] = 0
    state["current_password"] = ""
    state["percentage"] = 0.0

    pdf2john = shutil.which('pdf2john.py') or shutil.which('pdf2john')
    hashcat = shutil.which('hashcat')
    if not pdf2john or not hashcat:
        state["log"].append("⚠️ hashcat or pdf2john.py not found in PATH. Falling back to multi-threaded CPU cracking...")
        crack_worker(pdf_path, wordlist_path, use_wordlist, use_patterns, use_rules)
        return

    # create hash file
    hash_file = 'pdf_hash.txt'
    try:
        state["log"].append(f"📦 Running {os.path.basename(pdf2john)} to extract PDF hash...")
        with open(hash_file, 'w', encoding='utf-8') as hf:
            proc = subprocess.run([pdf2john, pdf_path], stdout=hf, stderr=subprocess.PIPE, text=True)
        state["log"].append("📦 Hash extraction complete")
    except Exception as e:
        state["status"] = "error"
        state["log"].append(f"❌ Failed to extract hash: {e}")
        return

    # Prepare hashcat command
    opts = hashcat_opts.split() if isinstance(hashcat_opts, str) and hashcat_opts.strip() else ['-m', '10500']
    out_file = 'hashcat_found.txt'
    cmd = [hashcat] + opts + [hash_file, wordlist_path, '-o', out_file, '--quiet', '--status', '--status-timer=3']

    state["log"].append(f"🚀 Launching hashcat: {' '.join(cmd)}")
    try:
        # stream output
        with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as p:
            for line in p.stdout:
                line = line.strip()
                if not line:
                    continue
                state["log"].append(line)
                # try to parse progress lines (simple heuristic)
                if '%' in line:
                    try:
                        # extract first percentage occurrence
                        pct = float(line.split('%')[0].split()[-1])
                        state["percentage"] = round(pct, 2)
                    except:
                        pass
        ret = p.wait()
    except Exception as e:
        state["status"] = "error"
        state["log"].append(f"❌ hashcat failed: {e}")
        return

    # Check output file for cracked password
    if os.path.exists(out_file):
        try:
            with open(out_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read().strip()
            if content:
                # hashcat output format: <hash>:<password>
                pwd = content.split(':', 1)[1] if ':' in content else content
                pwd = pwd.strip()
                state["password"] = pwd
                # try to save decrypted PDF
                try:
                    with pikepdf.open(pdf_path, password=pwd) as pdf:
                        pdf.save(OUTPUT_PATH)
                    state["log"].append(f"✅ Password found via hashcat: {pwd}")
                    state["status"] = "done"
                    state["percentage"] = 100.0
                    return
                except Exception as e:
                    state["log"].append(f"⚠️ Password found but failed to save PDF: {e}")
                    state["status"] = "error"
                    return
        except Exception as e:
            state["log"].append(f"⚠️ Error reading hashcat output: {e}")

    # if nothing found
    state["status"] = "not_found"
    state["log"].append("❌ hashcat finished - no password found")


def crack_worker(pdf_path, wordlist_path, use_wordlist=True, use_patterns=False, use_rules=False):
    """Enhanced cracking with threading, patterns, and rules"""
    state["status"] = "cracking"
    state["attempts"] = 0
    state["log"] = []
    state["current_password"] = ""
    state["percentage"] = 0
    state["threads_active"] = 0
    
    all_candidates = []
    passwords_found = [None]  # Use list to share across threads
    
    try:
        base_words = []
        if use_wordlist or use_rules:
            state["log"].append(f"📂 Loading wordlist: {TOTAL_WORDS:,} entries")
            if not os.path.exists(wordlist_path):
                state["status"] = "error"
                state["log"].append(f"❌ Wordlist not found at {wordlist_path}")
                return
            
            with open(wordlist_path, "r", encoding="latin-1", errors="ignore") as wl:
                base_words = [line.strip() for line in wl if line.strip()]
            state["log"].append(f"📂 Loaded {len(base_words):,} words from wordlist")
        
        if use_wordlist:
            all_candidates.extend(base_words)
        
        # Phase 2: Generate pattern candidates if enabled
        if use_patterns:
            state["log"].append("🎯 Generating pattern-based passwords...")
            patterns = generate_patterns([])
            all_candidates.extend(patterns)
            state["log"].append(f"🎯 Generated {len(patterns):,} patterns")
        
        # Phase 3: Generate rule-based mutations if enabled
        if use_rules:
            state["log"].append("🔀 Applying rule-based mutations...")
            mutations = set()
            for word in base_words[:5000]:  # Limit to avoid explosion
                mutations.update(apply_rules(word))
            all_candidates.extend(list(mutations))
            state["log"].append(f"🔀 Generated {len(mutations):,} rule mutations")
        
        total_candidates = len(all_candidates)
        state["total_words"] = total_candidates
        state["log"].append(f"🚀 Starting crack with {MAX_WORKERS} threads...")
        state["log"].append(f"🚀 Total passwords to try: {total_candidates:,}")
        
        # Phase 4: Multi-threaded cracking
        attempt_count = [0]  # Shared counter using list
        
        def worker_thread(candidates_batch, worker_id):
            state["threads_active"] += 1
            try:
                for candidate in candidates_batch:
                    if passwords_found[0] is not None:
                        state["threads_active"] -= 1
                        return  # Password already found
                    
                    attempt_count[0] += 1
                    state["attempts"] = attempt_count[0]
                    state["current_password"] = candidate
                    # keep a fractional percentage so progress is visible on large lists
                    state["percentage"] = round((state["attempts"] / total_candidates) * 100, 2) if total_candidates > 0 else 0.0
                    
                    if state["attempts"] % 5000 == 0:
                        state["log"].append(f"⏳ Tried {state['attempts']:,}/{total_candidates:,}... {state['percentage']:.1f}%")
                    
                    if try_password(pdf_path, candidate):
                        passwords_found[0] = candidate
                        state["threads_active"] -= 1
                        return
            except Exception as e:
                state["log"].append(f"⚠️ Thread {worker_id} error: {e}")
            finally:
                state["threads_active"] -= 1
        
        # Divide work among threads
        batch_size = max(1, total_candidates // MAX_WORKERS)
        threads = []
        for i in range(MAX_WORKERS):
            start = i * batch_size
            end = (i + 1) * batch_size if i < MAX_WORKERS - 1 else total_candidates
            batch = all_candidates[start:end]
            if batch:
                t = threading.Thread(target=worker_thread, args=(batch, i), daemon=True)
                threads.append(t)
                t.start()
        
        # Wait for all threads
        for t in threads:
            t.join(timeout=300)  # 5 minute timeout per thread
        
        # Check result
        if passwords_found[0]:
            saved_successfully = False
            try:
                pdf = pikepdf.open(pdf_path, password=passwords_found[0])
                pdf.save(OUTPUT_PATH, min_version=pdf.pdf_version)
                pdf.close()
                saved_successfully = True
                state["log"].append(f"✅ PDF decrypted and saved successfully")
            except Exception as save_error:
                state["log"].append(f"⚠️ Error saving PDF: {save_error}")
            
            state["password"] = passwords_found[0]
            state["status"] = "done"
            state["log"].append(f"✅ PASSWORD FOUND: '{passwords_found[0]}'")
            state["log"].append(f"✅ Found after {state['attempts']:,} attempts ({state['percentage']:.1f}%)")
            state["percentage"] = 100.0
        else:
            state["status"] = "not_found"
            state["log"].append(f"❌ Exhausted all {total_candidates:,} passwords")
            state["log"].append("❌ Password not found!")
            state["percentage"] = 100.0
    
    except Exception as e:
        state["status"] = "error"
        state["log"].append(f"❌ Fatal error: {e}")
    
    state["threads_active"] = 0

pdf_form = '''
<!DOCTYPE html>
<html>
<head>
    <title>Advanced PDF Password Cracker</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 5px; }
        .subtitle { color: #7f8c8d; margin-bottom: 20px; font-size: 14px; }
        .form-group { margin: 20px 0; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #2c3e50; }
        input[type="file"], input[type="text"] { width: 100%; padding: 10px; border: 1px solid #bdc3c7; border-radius: 4px; box-sizing: border-box; }
        .checkbox-group { display: flex; gap: 20px; margin: 10px 0; }
        .checkbox-group label { display: flex; align-items: center; margin: 0; }
        input[type="checkbox"] { margin-right: 8px; }
        .info-box { background: #ecf0f1; padding: 10px; border-radius: 4px; font-size: 13px; margin: 10px 0; border-left: 4px solid #3498db; }
        button { width: 100%; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
        button:hover { background: #229954; }
        .btn-secondary { background: #95a5a6; margin-top: 10px; }
        .btn-secondary:hover { background: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Advanced PDF Password Cracker</h1>
        <p class="subtitle">Recover passwords using multiple cracking methods</p>
        
        <form method="post" enctype="multipart/form-data">
            <!-- File Upload -->
            <div class="form-group">
                <label for="pdf_file">📄 Select Password-Protected PDF:</label>
                <input type="file" name="pdf_file" id="pdf_file" accept="application/pdf" required>
            </div>

            <!-- Cracking Methods -->
            <div class="form-group">
                <label>🎯 Cracking Methods:</label>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" name="use_wordlist" checked> Wordlist
                    </label>
                    <label>
                        <input type="checkbox" name="use_patterns"> Patterns
                    </label>
                    <label>
                        <input type="checkbox" name="use_rules"> Rules
                    </label>
                </div>
                <div class="info-box">
                    <strong>📚 Wordlist:</strong> Standard dictionary attack<br>
                    <strong>🎯 Patterns:</strong> Generate numbers, sequences, common passwords<br>
                    <strong>🔀 Rules:</strong> Apply mutations to wordlist (capitals, numbers, special chars, leet speak)
                </div>
            </div>

            <!-- GPU Note -->
            <div class="info-box" style="border-left-color: #e74c3c;">
                <strong>⚡ Hardware Acceleration:</strong> Using multithreading ({{ threads }} threads) for speed optimization. GPU support depends on system capabilities.
            </div>

            <!-- GPU / Hashcat -->
            <div class="form-group">
                <label>⚙️ GPU / Hashcat (optional):</label>
                <div class="info-box">
                    <label style="font-weight:normal"><input type="checkbox" name="use_gpu"> Use GPU (Hashcat)</label>
                    <div style="margin-top:8px">
                        <label style="display:block; font-size:13px; margin-bottom:6px">Hashcat args (example: -m 10500):</label>
                        <input type="text" name="hashcat_opts" placeholder="-m 10500" value="-m 10500">
                        <p style="font-size:12px; color:#555; margin-top:6px">Requires <strong>hashcat</strong> and <strong>pdf2john.py</strong> in PATH. Leave empty to use defaults.</p>
                    </div>
                </div>
            </div>

            <button type="submit">🚀 Start Cracking</button>
            <button type="button" class="btn-secondary" onclick="window.location.href='/'">↩️ Reset</button>
        </form>
    </div>
</body>
</html>
'''

status_page = '''
<!DOCTYPE html>
<html>
<head>
    <title>Password Cracking Progress</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .progress-bar { width: 100%; height: 40px; background: #ddd; border-radius: 4px; overflow: hidden; margin: 15px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #27ae60, #2ecc71); transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }
        .stat-box { background: #ecf0f1; padding: 15px; border-radius: 4px; border-left: 4px solid #3498db; }
        .stat-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: bold; }
        .stat-value { font-size: 24px; color: #2c3e50; font-weight: bold; margin-top: 5px; font-family: monospace; }
        .status-box { padding: 15px; background: #f9f9f9; border-left: 4px solid #2196F3; margin: 10px 0; border-radius: 4px; }
        .success { border-left-color: #4CAF50; background: #e8f5e9; }
        .error { border-left-color: #f44336; background: #ffebee; }
        .info { font-size: 14px; color: #666; margin: 8px 0; }
        .log { background: #f0f0f0; padding: 10px; border-radius: 4px; height: 250px; overflow-y: auto; font-family: monospace; font-size: 12px; margin: 15px 0; border: 1px solid #bdc3c7; }
        .log-item { padding: 3px 0; line-height: 1.4; }
        .threads { font-size: 12px; color: #27ae60; font-weight: bold; }
        button { padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1976D2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Advanced Password Cracking Progress</h1>
        
        <div id="status-container">
            <div class="status-box">
                <h3>Status: <span id="status-text">Loading...</span></h3>
                <p class="threads">⚡ Active Threads: <span id="threads">0</span>/{{ threads }}</p>
            </div>

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-label">Attempts</div>
                    <div class="stat-value"><span id="attempts">0</span>/<span id="total">{{ total_words }}</span></div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Progress</div>
                    <div class="stat-value"><span id="percentage">0</span>%</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Remaining Time</div>
                    <div class="stat-value"><span id="eta">∞</span></div>
                </div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" id="progress" style="width: 0%">0%</div>
            </div>

            <div class="info">
                <strong>Current Password:</strong> <code id="current-pwd">-</code>
            </div>

            <div id="success-box" class="status-box success" style="display:none;">
                <h3>✅ PASSWORD FOUND!</h3>
                <p><strong>Password:</strong> <code style="font-size: 16px;" id="found-password"></code></p>
                <p>
                    <a href="/download"><button>📥 Download Decrypted PDF</button></a>
                    <a href="/"><button>↩️ Back to Home</button></a>
                </p>
            </div>

            <div id="error-box" class="status-box error" style="display:none;">
                <h3>❌ Error or Not Found</h3>
                <p id="error-message"></p>
                <a href="/"><button>↩️ Back to Home</button></a>
            </div>
        </div>

        <h3>📋 Detailed Log:</h3>
        <div class="log" id="log"></div>
    </div>

    <script>
        let startTime = Date.now();
        
        function updateStatus() {
            fetch('/status-json')
                .then(r => r.json())
                .then(data => {
                    const { status, password, attempts, total_words, current_password, log, percentage, threads_active } = data;
                    
                    document.getElementById('status-text').textContent = status.toUpperCase();
                    document.getElementById('threads').textContent = threads_active;
                    document.getElementById('attempts').textContent = attempts.toLocaleString();
                    document.getElementById('total').textContent = total_words.toLocaleString();
                    // show percentage with one decimal so small progress is visible
                    const pct = Number(percentage).toFixed(1);
                    document.getElementById('percentage').textContent = pct;
                    document.getElementById('progress').style.width = pct + '%';
                    document.getElementById('progress').textContent = pct + '%';
                    document.getElementById('current-pwd').textContent = current_password || '-';
                    
                    // Calculate ETA
                    if (attempts > 0 && total_words > 0) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const rate = attempts / elapsed;
                        const remaining = total_words - attempts;
                        const eta_seconds = remaining / rate;
                        if (eta_seconds < 1) {
                            document.getElementById('eta').textContent = '< 1s';
                        } else if (eta_seconds < 60) {
                            document.getElementById('eta').textContent = Math.ceil(eta_seconds) + 's';
                        } else if (eta_seconds < 3600) {
                            document.getElementById('eta').textContent = Math.ceil(eta_seconds / 60) + 'm';
                        } else {
                            document.getElementById('eta').textContent = Math.ceil(eta_seconds / 3600) + 'h';
                        }
                    }
                    
                    // Update log
                    document.getElementById('log').innerHTML = log.map(l => '<div class="log-item">' + l + '</div>').join('');
                    const logEl = document.getElementById('log');
                    logEl.scrollTop = logEl.scrollHeight;
                    
                    // Show results
                    if (status === 'done') {
                        document.getElementById('success-box').style.display = 'block';
                        document.getElementById('found-password').textContent = password;
                        return;
                    } else if (status === 'error' || status === 'not_found') {
                        document.getElementById('error-box').style.display = 'block';
                        if (status === 'error') {
                            document.getElementById('error-message').textContent = log[log.length - 1] || 'An error occurred';
                        } else {
                            document.getElementById('error-message').textContent = 'Password not found after trying ' + attempts.toLocaleString() + ' variations.';
                        }
                        return;
                    }
                    
                    // Keep polling if still cracking
                    if (status === 'cracking') {
                        setTimeout(updateStatus, 300);
                    }
                });
        }
        
        updateStatus();
    </script>
</body>
</html>
'''


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        pdf_file = request.files.get('pdf_file')
        if not pdf_file or pdf_file.filename == '':
            return "No file uploaded", 400

        try:
            pdf_file.save(UPLOAD_PATH)
        except Exception as e:
            return f"Error saving file: {e}", 400
        
        state["log"] = []
        
        # Get cracking options from form
        use_wordlist = request.form.get('use_wordlist') == 'on'
        use_patterns = request.form.get('use_patterns') == 'on'
        use_rules = request.form.get('use_rules') == 'on'
        
        # At least one method must be selected
        if not (use_wordlist or use_patterns or use_rules):
            use_wordlist = True  # Default to wordlist
        
        state["log"].append(f"📋 Cracking methods: Wordlist={use_wordlist}, Patterns={use_patterns}, Rules={use_rules}")

        # First check if it's even encrypted
        try:
            with pikepdf.open(UPLOAD_PATH) as pdf:
                # Opened without a password -> not encrypted
                try:
                    pdf.save(OUTPUT_PATH)
                except:
                    pass
                state["status"] = "done"
                state["password"] = "(none - file was not password protected)"
                state["log"].append("✅ File is not password protected!")
                state["percentage"] = 100.0
                return render_template_string(status_page, threads=MAX_WORKERS, **state)
        except pikepdf.PasswordError:
            pass  # it IS encrypted, proceed to cracking
        except Exception as e:
            state["status"] = "error"
            state["log"].append(f"❌ Error reading PDF: {e}")
            return render_template_string(status_page, threads=MAX_WORKERS, **state), 400

        # Run cracking in background (GPU or CPU)
        use_gpu = request.form.get('use_gpu') == 'on'
        hashcat_opts = request.form.get('hashcat_opts') or '-m 10500'

        if use_gpu:
            state["log"].append(f"🚀 Using GPU (hashcat) with options: {hashcat_opts}")
            thread = threading.Thread(
                target=run_hashcat_worker,
                args=(UPLOAD_PATH, WORDLIST_PATH, hashcat_opts, use_wordlist, use_patterns, use_rules),
                daemon=True,
            )
        else:
            thread = threading.Thread(
                target=crack_worker, 
                args=(UPLOAD_PATH, WORDLIST_PATH, use_wordlist, use_patterns, use_rules),
                daemon=True
            )
        thread.start()
        time.sleep(0.5)  # Give thread time to start

        # Show status page immediately with live updates via AJAX
        return render_template_string(status_page, threads=MAX_WORKERS, **state)
    else:
        return render_template_string(pdf_form, threads=MAX_WORKERS)


@app.route('/status')
def status():
    return render_template_string(status_page, **state)


@app.route('/status-json')
def status_json():
    """Return status as JSON for live updates"""
    return jsonify({
        "status": state["status"],
        "password": state["password"],
        "attempts": state["attempts"],
        "current_password": state["current_password"],
        "total_words": state["total_words"],
        "percentage": state["percentage"],
        "threads_active": state["threads_active"],
        "log": state["log"],
    })


@app.route('/download')
def download_pdf():
    if not os.path.exists(OUTPUT_PATH):
        return "No decrypted file available yet", 404
    return send_file(OUTPUT_PATH, as_attachment=True)


@app.route('/protect', methods=['POST'])
def protect():
    pdf_file = request.files.get('pdf_file')
    password = request.form.get('password')
    if not pdf_file or not password:
        return "Missing file or password", 400
    
    temp_in = "temp_in_protect.pdf"
    try:
        pdf_file.save(temp_in)
        
        noprint = request.form.get('perm_print') == 'true'
        nocopy = request.form.get('perm_copy') == 'true'
        noedit = request.form.get('perm_edit') == 'true'
        
        permissions = pikepdf.Permissions(
            accessibility=True,
            extract=not nocopy,
            modify_assembly=not noedit,
            modify_form=not noedit,
            modify_annotation=not noedit,
            modify_other=not noedit,
            print_lowres=not noprint,
            print_highres=not noprint
        )
        
        import io
        out_buffer = io.BytesIO()
        try:
            with pikepdf.open(temp_in) as pdf:
                pdf.save(
                    out_buffer,
                    encryption=pikepdf.Encryption(
                        user=password,
                        owner=password + "_owner",
                        R=4,
                        allow=permissions
                    )
                )
        except pikepdf.PasswordError:
            return "This PDF is already password protected. You cannot protect it again.", 400
        out_buffer.seek(0)
        return send_file(
            out_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="protected.pdf"
        )
    except Exception as e:
        return f"Encryption failed: {str(e)}", 500
    finally:
        if os.path.exists(temp_in):
            try:
                os.remove(temp_in)
            except:
                pass


if __name__ == '__main__':
    # debug=False on purpose - Flask's debugger allows arbitrary code
    # execution if exposed, even on localhost, so keep this off.
    app.run(host="127.0.0.1", port=5000, debug=False)