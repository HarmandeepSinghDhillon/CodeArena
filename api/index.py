import os
import json
import tempfile
import subprocess
import sys
import traceback
import ast
import requests
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, make_response, redirect
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, auth

app = Flask(__name__, static_folder='../public', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'harisonputter9878')

CORS(app, supports_credentials=True)

EXECUTION_TIMEOUT = 10

# Initialize Firebase
firebase_creds_str = os.environ.get('FIREBASE_CREDENTIALS')
if firebase_creds_str:
    try:
        cred_dict = json.loads(firebase_creds_str)
        cred = credentials.Certificate(cred_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
    except Exception:
        pass
else:
    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app()
        except ValueError:
            pass

db = firestore.client()
FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')

# ========== SIMPLE CACHE ==========
cache = {
    'problems': None,
    'problems_time': None,
    'stats': None,
    'stats_time': None
}
CACHE_DURATION = 300

def get_cached(key):
    if cache.get(key) and cache.get(f'{key}_time'):
        if (datetime.now() - cache[f'{key}_time']).seconds < CACHE_DURATION:
            return cache[key]
    return None

def set_cache(key, value):
    cache[key] = value
    cache[f'{key}_time'] = datetime.now()

# ========== AUTH DECORATOR ==========
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('auth_token')
        if not token:
            return jsonify({'error': 'Unauthorized', 'authenticated': False}), 401
        try:
            decoded_token = auth.verify_id_token(token)
            request.uid = decoded_token['uid']
            user_doc = db.collection('users').document(request.uid).get()
            if user_doc.exists:
                request.user_data = user_doc.to_dict()
            else:
                request.user_data = {'role': 'user'}
        except Exception as e:
            return jsonify({'error': str(e), 'authenticated': False}), 401
        return f(*args, **kwargs)
    return decorated_function

# ========== ROUTES ==========
@app.route('/')
def landing():
    """Landing page - login page"""
    token = request.cookies.get('auth_token')
    if token:
        try:
            auth.verify_id_token(token)
            return redirect('/dashboard')
        except:
            pass
    return send_from_directory('../public', 'index.html')

@app.route('/dashboard')
def dashboard():
    """Main app - requires authentication"""
    token = request.cookies.get('auth_token')
    if not token:
        return redirect('/')
    try:
        auth.verify_id_token(token)
        return send_from_directory('../public', 'dashboard.html')
    except:
        return redirect('/')

@app.route('/admin')
def admin_panel():
    token = request.cookies.get('auth_token')
    if not token:
        return redirect('/')
    try:
        decoded = auth.verify_id_token(token)
        user_doc = db.collection('users').document(decoded['uid']).get()
        if user_doc.exists and user_doc.to_dict().get('role') == 'admin':
            return send_from_directory('../public', 'admin.html')
        return redirect('/dashboard')
    except:
        return redirect('/')

@app.route('/signup')
def signup_page():
    token = request.cookies.get('auth_token')
    if token:
        try:
            auth.verify_id_token(token)
            return redirect('/dashboard')
        except:
            pass
    return send_from_directory('../public', 'signup.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../public', path)

# ========== API ROUTES ==========
@app.route('/api/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        users_ref = db.collection('users')
        
        # Quick checks
        existing = list(users_ref.where('username', '==', username).limit(1).stream())
        if existing:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        existing_email = list(users_ref.where('email', '==', email).limit(1).stream())
        if existing_email:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        # Firebase Auth
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True}, timeout=10)

        if r.status_code != 200:
            error_msg = r.json().get('error', {}).get('message', 'Signup failed')
            return jsonify({'success': False, 'message': error_msg}), 400

        auth_data = r.json()
        uid = auth_data['localId']
        id_token = auth_data['idToken']

        # Create user document
        users_ref.document(uid).set({
            'id': uid,
            'username': username,
            'email': email,
            'role': 'user',
            'created_at': datetime.now().isoformat(),
            'progress': {},
            'last_active': datetime.now().isoformat()
        })

        resp = make_response(jsonify({'success': True, 'role': 'user', 'username': username}))
        resp.set_cookie('auth_token', id_token, httponly=True, secure=False, samesite='Lax', max_age=86400)
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        users_ref = db.collection('users')
        query = users_ref.where('username', '==', username).limit(1).stream()
        user_doc = next(query, None)

        if not user_doc:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        user_data = user_doc.to_dict()
        email = user_data.get('email')

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True}, timeout=10)

        if r.status_code != 200:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        auth_data = r.json()
        id_token = auth_data['idToken']

        # Update last active
        try:
            db.collection('users').document(user_doc.id).update({'last_active': datetime.now().isoformat()})
        except:
            pass

        resp = make_response(jsonify({'success': True, 'role': user_data['role'], 'username': username}))
        resp.set_cookie('auth_token', id_token, httponly=True, secure=False, samesite='Lax', max_age=86400)
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    resp = make_response(jsonify({'success': True}))
    resp.set_cookie('auth_token', '', expires=0)
    return resp

@app.route('/api/check-auth', methods=['GET'])
@require_auth
def check_auth():
    try:
        db.collection('users').document(request.uid).update({'last_active': datetime.now().isoformat()})
    except:
        pass
    return jsonify({
        'authenticated': True,
        'role': request.user_data.get('role'),
        'username': request.user_data.get('username')
    })

# ========== USER PROGRESS ==========
@app.route('/api/user/progress', methods=['GET'])
@require_auth
def get_user_progress():
    try:
        progress = request.user_data.get('progress', {})
        
        problems_count = get_cached('problems')
        if problems_count is None:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems', problems_count)

        solved_problems = len([p for p in progress.values() if p.get('solved', False)])
        solved_ids = [int(pid) for pid, p in progress.items() if p.get('solved', False)]

        return jsonify({
            'progress': progress,
            'stats': {
                'total': problems_count,
                'solved': solved_problems,
                'percentage': (solved_problems / problems_count * 100) if problems_count > 0 else 0
            },
            'solvedIds': solved_ids
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/progress', methods=['POST'])
@require_auth
def update_user_progress():
    try:
        data = request.json
        problem_id = str(data.get('problemId'))
        solved = data.get('solved', False)

        user_ref = db.collection('users').document(request.uid)
        user_doc = user_ref.get()
        
        current_progress = user_doc.to_dict().get('progress', {}) if user_doc.exists else {}

        if problem_id not in current_progress:
            current_progress[problem_id] = {}

        current_progress[problem_id]['solved'] = solved
        current_progress[problem_id]['last_attempt'] = datetime.now().isoformat()
        
        if solved and 'solved_at' not in current_progress[problem_id]:
            current_progress[problem_id]['solved_at'] = datetime.now().isoformat()

        user_ref.update({'progress': current_progress})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== ADMIN ROUTES ==========
@app.route('/api/admin/stats', methods=['GET'])
@require_auth
def admin_get_stats():
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        cached_stats = get_cached('stats')
        if cached_stats:
            return jsonify(cached_stats)

        users_docs = list(db.collection('users').where('role', '==', 'user').stream())
        total_users = len(users_docs)
        
        problems_count = get_cached('problems')
        if problems_count is None:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems', problems_count)

        total_solved = 0
        active_count = 0
        current_time = datetime.now()

        for doc in users_docs:
            u_data = doc.to_dict()
            progress = u_data.get('progress', {})
            total_solved += len([p for p in progress.values() if p.get('solved', False)])

            last_active_str = u_data.get('last_active')
            if last_active_str:
                try:
                    last_active = datetime.fromisoformat(last_active_str)
                    if (current_time - last_active).seconds <= 300:
                        active_count += 1
                except:
                    pass

        stats = {
            'totalUsers': total_users,
            'totalProblems': problems_count,
            'totalSubmissions': total_solved,
            'activeUsers': active_count
        }
        
        set_cache('stats', stats)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@require_auth
def admin_get_users():
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        users_list = []
        current_time = datetime.now()
        
        problems_count = get_cached('problems')
        if problems_count is None:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems', problems_count)

        for doc in db.collection('users').where('role', '==', 'user').stream():
            u = doc.to_dict()
            is_active = False
            if u.get('last_active'):
                try:
                    last_active_time = datetime.fromisoformat(u['last_active'])
                    if (current_time - last_active_time).seconds <= 300:
                        is_active = True
                except:
                    pass

            solved_problems = []
            for pid, prog in u.get('progress', {}).items():
                if prog.get('solved', False):
                    solved_problems.append({
                        'problem_id': int(pid),
                        'solved_at': prog.get('solved_at')
                    })

            users_list.append({
                'id': u.get('id'),
                'username': u.get('username'),
                'email': u.get('email'),
                'created_at': u.get('created_at'),
                'solved_count': len(solved_problems),
                'solved_problems': solved_problems,
                'is_active': is_active,
                'last_active': u.get('last_active'),
                'total_problems': problems_count
            })
        return jsonify({'users': users_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems', methods=['GET'])
@require_auth
def admin_get_problems():
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        cached = get_cached('problems_full')
        if cached:
            return jsonify({'problems': cached})
        
        problems = [doc.to_dict() for doc in db.collection('problems').order_by('id').stream()]
        set_cache('problems_full', problems)
        return jsonify({'problems': problems})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems', methods=['POST'])
@require_auth
def admin_add_problem():
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        new_problem = request.json
        problems = list(db.collection('problems').stream())
        max_id = max([doc.to_dict().get('id', 0) for doc in problems], default=0)
        new_problem['id'] = max_id + 1
        db.collection('problems').document(str(new_problem['id'])).set(new_problem)
        
        # Invalidate cache
        cache['problems'] = None
        cache['problems_full'] = None
        cache['stats'] = None
        
        return jsonify({'success': True, 'problem': new_problem})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems/<int:problem_id>', methods=['PUT'])
@require_auth
def admin_update_problem(problem_id):
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        updated_problem = request.json
        updated_problem['id'] = problem_id
        db.collection('problems').document(str(problem_id)).set(updated_problem)
        
        cache['problems'] = None
        cache['problems_full'] = None
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems/<int:problem_id>', methods=['DELETE'])
@require_auth
def admin_delete_problem(problem_id):
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        db.collection('problems').document(str(problem_id)).delete()
        
        cache['problems'] = None
        cache['problems_full'] = None
        cache['stats'] = None
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== CODE EXECUTION ==========
@app.route('/api/problems', methods=['GET', 'OPTIONS'])
def get_problems():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        cached = get_cached('problems_full')
        if cached:
            return jsonify({'problems': cached})
        
        problems = [doc.to_dict() for doc in db.collection('problems').order_by('id').stream()]
        if not problems:
            default_prob = {
                "id": 1,
                "title": "Two Sum",
                "difficulty": "Easy",
                "description": "Given an array of integers...",
                "examples": [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}],
                "constraints": ["2 <= nums.length <= 10^4"],
                "starterCode": "def two_sum(nums, target):\n    pass",
                "testCases": [{"input": "[2,7,11,15]\n9", "expected": "[0, 1]"}]
            }
            db.collection('problems').document('1').set(default_prob)
            problems.append(default_prob)
        
        set_cache('problems_full', problems)
        return jsonify({'problems': problems})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/run', methods=['POST', 'OPTIONS'])
def run_code():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.json
        code = data.get('code', '')
        user_input = data.get('input', '')
        if not code.strip():
            return jsonify({'error': 'No code provided'}), 400

        wrapper_code = f'''
import builtins, sys, io, traceback
output_capture = io.StringIO()
sys.stdout = output_capture
_original_input = builtins.input

def _custom_input(prompt=''):
    try:
        return _original_input()
    except EOFError:
        return ""

builtins.input = _custom_input

try:
{chr(10).join('    ' + line for line in code.split(chr(10)))}
except Exception as e:
    print(f"Error: {{e}}")
    traceback.print_exc()

sys.stdout = sys.__stdout__
print(output_capture.getvalue())
'''
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(wrapper_code)
            temp_file = f.name
        try:
            process = subprocess.Popen([sys.executable, temp_file], stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE, text=True, encoding='utf-8')
            stdout, stderr = process.communicate(input=user_input, timeout=EXECUTION_TIMEOUT)
            output = stdout.strip()
            return jsonify({'output': output if output else 'No output', 'error': bool(stderr)})
        except subprocess.TimeoutExpired:
            process.kill()
            return jsonify({'output': 'Timeout', 'error': True})
        finally:
            try:
                os.unlink(temp_file)
            except:
                pass
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit', methods=['POST', 'OPTIONS'])
def submit_solution():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.json
        code = data.get('code', '')
        problem_id = data.get('problemId')
        test_cases = data.get('testCases', [])
        
        if not code.strip():
            return jsonify({'error': 'No code provided'}), 400

        results = []
        all_passed = True
        
        for i, test_case in enumerate(test_cases):
            test_input = test_case.get('input', '')
            expected_output = test_case.get('expected', '').strip()
            
            test_code = f'''
import builtins, sys, io, ast
output_capture = io.StringIO()
sys.stdout = output_capture

_input_values = []
_input_index = 0

lines = """{test_input}""".strip().split('\\n')
for line in lines:
    if line.strip():
        try:
            _input_values.append(ast.literal_eval(line.strip()))
        except:
            _input_values.append(line.strip())

def custom_input(prompt=''):
    global _input_index
    if _input_index < len(_input_values):
        val = _input_values[_input_index]
        _input_index += 1
        return str(val)
    return ""

builtins.input = custom_input

try:
{chr(10).join('    ' + line for line in code.split(chr(10)))}
except Exception as e:
    print(f"Error: {{e}}")

print(output_capture.getvalue().strip())
'''
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(test_code)
                temp_file = f.name
            try:
                proc = subprocess.run([sys.executable, temp_file], capture_output=True, text=True, timeout=EXECUTION_TIMEOUT)
                actual = proc.stdout.strip()
                passed = actual == expected_output
                results.append({'testCase': i + 1, 'input': test_input, 'expected': expected_output, 'output': actual or '(no output)', 'passed': passed})
                if not passed:
                    all_passed = False
            except subprocess.TimeoutExpired:
                results.append({'testCase': i + 1, 'input': test_input, 'expected': expected_output, 'output': 'Timeout', 'passed': False})
                all_passed = False
            finally:
                try:
                    os.unlink(temp_file)
                except:
                    pass

        # Update progress if all passed
        if all_passed:
            token = request.cookies.get('auth_token')
            if token:
                try:
                    decoded = auth.verify_id_token(token)
                    user_ref = db.collection('users').document(decoded['uid'])
                    user_doc = user_ref.get()
                    progress = user_doc.to_dict().get('progress', {}) if user_doc.exists else {}
                    problem_id_str = str(problem_id)
                    if problem_id_str not in progress:
                        progress[problem_id_str] = {}
                    progress[problem_id_str]['solved'] = True
                    progress[problem_id_str]['solved_at'] = datetime.now().isoformat()
                    user_ref.update({'progress': progress})
                except:
                    pass

        return jsonify({'success': all_passed, 'results': results, 'totalTests': len(test_cases), 'passedTests': sum(1 for r in results if r['passed'])})
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=False, port=5000, host='0.0.0.0')