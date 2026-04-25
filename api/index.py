import os
import json
import tempfile
import subprocess
import sys
import traceback
import ast
import requests
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, make_response, redirect
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, auth

app = Flask(__name__, static_folder='../public', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'harisonputter9878')

# Configure CORS
CORS(app, supports_credentials=True, origins=[
    'https://py-compiler-ten.vercel.app',
    'https://py-compiler.vercel.app',
    'http://localhost:5000',
    'http://localhost:3000'
])

EXECUTION_TIMEOUT = 10

# Initialize Firebase
firebase_creds_str = os.environ.get('FIREBASE_CREDENTIALS')
if firebase_creds_str:
    try:
        cred_dict = json.loads(firebase_creds_str)
        cred = credentials.Certificate(cred_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Firebase init error: {e}")

db = firestore.client()
FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')

# Simple in-memory cache for better performance
auth_cache = {}
user_data_cache = {}
problems_cache = {}
cache_ttl = 300  # 5 minutes

def get_cached(key, cache_dict):
    if key in cache_dict:
        data, timestamp = cache_dict[key]
        if (datetime.now() - timestamp).seconds < cache_ttl:
            return data
        del cache_dict[key]
    return None

def set_cache(key, value, cache_dict):
    cache_dict[key] = (value, datetime.now())

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('auth_token')
        if not token:
            return jsonify({'error': 'Unauthorized', 'authenticated': False}), 401
        
        # Check cache
        cached = get_cached(token, auth_cache)
        if cached:
            request.uid = cached['uid']
            request.user_data = cached['user_data']
            return f(*args, **kwargs)
        
        try:
            decoded_token = auth.verify_id_token(token)
            request.uid = decoded_token['uid']
            
            user_doc = db.collection('users').document(request.uid).get()
            if user_doc.exists:
                request.user_data = user_doc.to_dict()
            else:
                request.user_data = {'role': 'user'}
            
            set_cache(token, {'uid': request.uid, 'user_data': request.user_data}, auth_cache)
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e), 'authenticated': False}), 401
    return decorated_function

# Route handlers - all routes go through Flask
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    """Handle all routes - let Flask decide based on auth"""
    token = request.cookies.get('auth_token')
    
    # API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Static file extensions - serve directly
    if path.endswith('.css') or path.endswith('.js') or path.endswith('.png') or path.endswith('.jpg'):
        return send_from_directory('../public', path)
    
    # Page routes with authentication check
    if path == 'login' or path == 'login.html':
        if token:
            try:
                auth.verify_id_token(token)
                return redirect('/')
            except:
                pass
        return send_from_directory('../public', 'login.html')
    
    if path == 'signup' or path == 'signup.html':
        if token:
            try:
                auth.verify_id_token(token)
                return redirect('/')
            except:
                pass
        return send_from_directory('../public', 'signup.html')
    
    if path == 'admin' or path == 'admin.html':
        if not token:
            return redirect('/login')
        try:
            decoded = auth.verify_id_token(token)
            user_doc = db.collection('users').document(decoded['uid']).get()
            if user_doc.exists and user_doc.to_dict().get('role') == 'admin':
                return send_from_directory('../public', 'admin.html')
            return redirect('/')
        except:
            return redirect('/login')
    
    # Home page - requires login
    if not path or path == '' or path == 'index.html':
        if not token:
            return redirect('/login')
        try:
            auth.verify_id_token(token)
            return send_from_directory('../public', 'index.html')
        except:
            return redirect('/login')
    
    # Default - try to serve static file
    try:
        return send_from_directory('../public', path)
    except:
        return redirect('/login')

# API Routes
@app.route('/api/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        # Check existing users
        users_ref = db.collection('users')
        existing = list(users_ref.where('username', '==', username).limit(1).stream())
        if existing:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        existing_email = list(users_ref.where('email', '==', email).limit(1).stream())
        if existing_email:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        # Create Firebase Auth user
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True}, timeout=10)

        if r.status_code != 200:
            error_msg = r.json().get('error', {}).get('message', 'Signup failed')
            return jsonify({'success': False, 'message': error_msg}), 400

        auth_data = r.json()
        uid = auth_data['localId']
        id_token = auth_data['idToken']

        # Create user document in Firestore
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
        resp.set_cookie('auth_token', id_token, httponly=True, secure=True, samesite='Lax', max_age=86400)
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
        role = data.get('role', 'user')

        # Find user by username
        users_ref = db.collection('users')
        query = users_ref.where('username', '==', username).where('role', '==', role).limit(1).stream()
        user_doc = next(query, None)

        if not user_doc:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        user_data = user_doc.to_dict()
        email = user_data.get('email')

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        # Sign in with Firebase Auth
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True}, timeout=10)

        if r.status_code != 200:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        auth_data = r.json()
        id_token = auth_data['idToken']

        # Update last active
        users_ref.document(user_doc.id).update({'last_active': datetime.now().isoformat()})

        resp = make_response(jsonify({'success': True, 'role': user_data['role'], 'username': username}))
        resp.set_cookie('auth_token', id_token, httponly=True, secure=True, samesite='Lax', max_age=86400)
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
    # Update last active asynchronously (don't wait for response)
    db.collection('users').document(request.uid).update({'last_active': datetime.now().isoformat()})
    return jsonify({
        'authenticated': True,
        'role': request.user_data.get('role'),
        'username': request.user_data.get('username')
    })

@app.route('/api/user/progress', methods=['GET'])
@require_auth
def get_user_progress():
    try:
        progress = request.user_data.get('progress', {})
        
        # Get cached problems count
        problems_data = get_cached('problems_list', problems_cache)
        if problems_data:
            problems_count = len(problems_data)
        else:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems_list', problems_count, problems_cache)

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
        
        if user_doc.exists:
            current_progress = user_doc.to_dict().get('progress', {})
        else:
            current_progress = {}

        if problem_id not in current_progress:
            current_progress[problem_id] = {}

        current_progress[problem_id]['solved'] = solved
        current_progress[problem_id]['last_attempt'] = datetime.now().isoformat()
        
        if solved and 'solved_at' not in current_progress[problem_id]:
            current_progress[problem_id]['solved_at'] = datetime.now().isoformat()

        user_ref.update({'progress': current_progress})
        return jsonify({'success': True, 'progress': current_progress[problem_id]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
@require_auth
def admin_get_stats():
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        users_docs = list(db.collection('users').where('role', '==', 'user').stream())
        total_users = len(users_docs)
        
        # Get cached problems count
        problems_count = get_cached('problems_list', problems_cache)
        if problems_count is None:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems_list', problems_count, problems_cache)
        
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

        return jsonify({
            'totalUsers': total_users,
            'totalProblems': problems_count,
            'totalSubmissions': total_solved,
            'activeUsers': active_count
        })
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
        
        problems_count = get_cached('problems_list', problems_cache)
        if problems_count is None:
            problems_count = len(list(db.collection('problems').stream()))
            set_cache('problems_list', problems_count, problems_cache)

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
                        'solved_at': prog.get('solved_at'),
                        'last_attempt': prog.get('last_attempt')
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
                'progress': u.get('progress', {}),
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
        problems = [doc.to_dict() for doc in db.collection('problems').order_by('id').stream()]
        for problem in problems:
            solved_count = 0
            for user_doc in db.collection('users').where('role', '==', 'user').stream():
                u = user_doc.to_dict()
                if u.get('progress', {}).get(str(problem['id']), {}).get('solved', False):
                    solved_count += 1
            problem['solved_by_count'] = solved_count
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
        # Clear cache
        global problems_cache
        problems_cache = {}
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
        # Clear cache
        global problems_cache
        problems_cache = {}
        return jsonify({'success': True, 'problem': updated_problem})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems/<int:problem_id>', methods=['DELETE'])
@require_auth
def admin_delete_problem(problem_id):
    if request.user_data.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        db.collection('problems').document(str(problem_id)).delete()
        # Clear cache
        global problems_cache
        problems_cache = {}
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/heartbeat', methods=['POST'])
@require_auth
def user_heartbeat():
    # Update without waiting for response
    try:
        db.collection('users').document(request.uid).update({'last_active': datetime.now().isoformat()})
    except:
        pass
    return jsonify({'success': True})

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
import builtins
import sys
import io
import traceback

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
            process = subprocess.Popen(
                [sys.executable, temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                text=True,
                encoding='utf-8'
            )
            try:
                stdout, stderr = process.communicate(input=user_input, timeout=EXECUTION_TIMEOUT)
                output = stdout.strip()
                if stderr:
                    return jsonify({'output': stderr, 'error': True})
                else:
                    return jsonify({'output': output if output else 'Code executed successfully (no output)', 'error': False})
            except subprocess.TimeoutExpired:
                process.kill()
                return jsonify({'output': 'Error: Code execution timed out', 'error': True})
        except Exception as e:
            return jsonify({'output': f'Error: {str(e)}', 'error': True})
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
            escaped_test_input = test_input.replace("'''", "\\'\\'\\'").replace('\\', '\\\\')
            escaped_code = code.replace("'''", "\\'\\'\\'").replace('\\', '\\\\')
            
            test_code = f'''
import builtins
import sys
import io
import json
import traceback
import ast

actual_output = None
output_capture = io.StringIO()
sys.stdout = output_capture

_input_values = []
_input_index = 0

def parse_input(input_str):
    if not input_str:
        return []
    lines = input_str.strip().split('\\n')
    result = []
    for line in lines:
        line = line.strip()
        if line:
            try:
                result.append(ast.literal_eval(line))
            except:
                result.append(line)
    return result

try:
    input_values = parse_input(\'\'\'{escaped_test_input}\'\'\')
except Exception as e:
    input_values = []
    print(f"Error parsing input: {{e}}")

def _custom_input(prompt=''):
    global _input_index
    if _input_index < len(input_values):
        val = input_values[_input_index]
        _input_index += 1
        return str(val) if not isinstance(val, str) else val
    return ""

builtins.input = _custom_input

try:
    exec(\'\'\'
{escaped_code}
\'\'\')
    function_names = ['two_sum', 'reverse_string', 'is_palindrome', 'is_valid']
    found_function = False
    for func_name in function_names:
        if func_name in dir():
            func = eval(func_name)
            found_function = True
            try:
                if len(input_values) == 1:
                    result = func(input_values[0])
                elif len(input_values) == 2:
                    result = func(input_values[0], input_values[1])
                else:
                    result = func(*input_values)
                if isinstance(result, bool):
                    actual_output = str(result).lower()
                elif isinstance(result, list):
                    actual_output = str(result)
                else:
                    actual_output = str(result)
                break
            except Exception as e:
                actual_output = f"Error calling function: {{str(e)}}"
                break
    if not found_function:
        actual_output = output_capture.getvalue().strip()
        if not actual_output:
            actual_output = "No output generated"
except Exception as e:
    actual_output = f"Error: {{str(e)}}"
    traceback.print_exc()

sys.stdout = sys.__stdout__
print(actual_output)
'''
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(test_code)
                temp_file = f.name
            try:
                process = subprocess.Popen(
                    [sys.executable, temp_file],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    stdin=subprocess.PIPE,
                    text=True,
                    encoding='utf-8'
                )
                try:
                    stdout, stderr = process.communicate(timeout=EXECUTION_TIMEOUT)
                    output_lines = stdout.strip().split('\n')
                    actual_output = output_lines[-1] if output_lines else ""
                    actual_output = actual_output.strip()
                    expected_output_clean = expected_output.strip()
                    
                    if expected_output_clean.lower() in ['true', 'false']:
                        actual_output = actual_output.lower()
                    
                    passed = actual_output == expected_output_clean
                    if not passed:
                        try:
                            actual_parsed = ast.literal_eval(actual_output)
                            expected_parsed = ast.literal_eval(expected_output_clean)
                            passed = actual_parsed == expected_parsed
                        except:
                            pass
                    
                    results.append({
                        'testCase': i + 1,
                        'input': test_input,
                        'expected': expected_output_clean,
                        'output': actual_output,
                        'passed': passed
                    })
                    if not passed:
                        all_passed = False
                except subprocess.TimeoutExpired:
                    process.kill()
                    results.append({
                        'testCase': i + 1,
                        'input': test_input,
                        'expected': expected_output_clean,
                        'output': 'Timeout',
                        'passed': False
                    })
                    all_passed = False
            except Exception as e:
                results.append({
                    'testCase': i + 1,
                    'input': test_input,
                    'expected': expected_output_clean,
                    'output': f'Error: {str(e)}',
                    'passed': False
                })
                all_passed = False
            finally:
                try:
                    os.unlink(temp_file)
                except:
                    pass

        # Update progress if all tests passed
        if all_passed:
            token = request.cookies.get('auth_token')
            if token:
                try:
                    decoded = auth.verify_id_token(token)
                    uid = decoded['uid']
                    problem_id_str = str(problem_id)
                    user_ref = db.collection('users').document(uid)
                    user_doc = user_ref.get()
                    
                    if user_doc.exists:
                        current_progress = user_doc.to_dict().get('progress', {})
                    else:
                        current_progress = {}

                    if problem_id_str not in current_progress:
                        current_progress[problem_id_str] = {}

                    current_progress[problem_id_str]['solved'] = True
                    current_progress[problem_id_str]['last_attempt'] = datetime.now().isoformat()
                    if 'solved_at' not in current_progress[problem_id_str]:
                        current_progress[problem_id_str]['solved_at'] = datetime.now().isoformat()
                    
                    user_ref.update({'progress': current_progress})
                except:
                    pass

        return jsonify({
            'success': all_passed,
            'results': results,
            'totalTests': len(test_cases),
            'passedTests': sum(1 for r in results if r['passed'])
        })
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/problems', methods=['GET', 'OPTIONS'])
def get_problems():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        # Check cache first
        cached_problems = get_cached('problems_full_list', problems_cache)
        if cached_problems:
            return jsonify({'problems': cached_problems})
        
        problems = [doc.to_dict() for doc in db.collection('problems').order_by('id').stream()]
        if not problems:
            default_prob = {
                "id": 1,
                "title": "Two Sum",
                "difficulty": "Easy",
                "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
                "examples": [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}],
                "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
                "starterCode": "def two_sum(nums, target):\n    pass",
                "testCases": [{"input": "[2,7,11,15]\n9", "expected": "[0, 1]"}]
            }
            db.collection('problems').document('1').set(default_prob)
            problems.append(default_prob)
        
        set_cache('problems_full_list', problems, problems_cache)
        return jsonify({'problems': problems})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'}), 200

# Vercel requires this
app = app

if __name__ == '__main__':
    app.run(debug=False, port=5000, host='0.0.0.0')