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

@app.route('/')
def serve_index():
    token = request.cookies.get('auth_token')
    if not token:
        return redirect('/login')
    try:
        auth.verify_id_token(token)
        return redirect('/dashboard')
    except Exception:
        return redirect('/login')

@app.route('/dashboard')
def serve_dashboard():
    token = request.cookies.get('auth_token')
    if not token:
        return redirect('/login')
    try:
        auth.verify_id_token(token)
        return send_from_directory('../public', 'dashboard.html')
    except Exception:
        return redirect('/login')

@app.route('/admin')
def serve_admin():
    token = request.cookies.get('auth_token')
    if not token:
        return redirect('/login')
    try:
        decoded = auth.verify_id_token(token)
        user_doc = db.collection('users').document(decoded['uid']).get()
        if user_doc.exists and user_doc.to_dict().get('role') == 'admin':
            return send_from_directory('../public', 'admin.html')
        return redirect('/login')
    except Exception:
        return redirect('/login')

@app.route('/login')
def serve_login():
    token = request.cookies.get('auth_token')
    if token:
        try:
            auth.verify_id_token(token)
            return redirect('/')
        except Exception:
            pass
    return send_from_directory('../public', 'index.html')

@app.route('/signup')
def serve_signup():
    token = request.cookies.get('auth_token')
    if token:
        try:
            auth.verify_id_token(token)
            return redirect('/')
        except Exception:
            pass
    return send_from_directory('../public', 'signup.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../public', path)

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
        if len(list(users_ref.where('username', '==', username).limit(1).stream())) > 0:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        if len(list(users_ref.where('email', '==', email).limit(1).stream())) > 0:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})

        if r.status_code != 200:
            return jsonify({'success': False, 'message': r.json().get('error', {}).get('message', 'Signup failed')}), 400

        auth_data = r.json()
        uid = auth_data['localId']
        id_token = auth_data['idToken']

        users_ref.document(uid).set({
            'id': uid,
            'username': username,
            'email': email,
            'role': 'user',
            'created_at': datetime.now().isoformat(),
            'progress': {},
            'last_active': datetime.now().isoformat()
        })

        resp = make_response(jsonify({'success': True, 'role': 'user', 'username': username, 'message': 'Account created successfully!'}))
        resp.set_cookie('auth_token', id_token, httponly=True, secure=True, samesite='Strict')
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

        users_ref = db.collection('users')
        query = users_ref.where('username', '==', username).where('role', '==', role).limit(1).stream()
        user_doc = next(query, None)

        if not user_doc:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        user_data = user_doc.to_dict()
        email = user_data.get('email')

        if not FIREBASE_API_KEY:
            return jsonify({'success': False, 'message': 'Server config error'}), 500

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        r = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True})

        if r.status_code != 200:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

        auth_data = r.json()
        id_token = auth_data['idToken']

        db.collection('users').document(user_doc.id).update({'last_active': datetime.now().isoformat()})

        resp = make_response(jsonify({'success': True, 'role': user_data['role'], 'username': username, 'message': f'Welcome back {username}!'}))
        resp.set_cookie('auth_token', id_token, httponly=True, secure=True, samesite='Strict')
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    resp = make_response(jsonify({'success': True, 'message': 'Logged out successfully'}))
    resp.set_cookie('auth_token', '', expires=0)
    return resp

@app.route('/api/check-auth', methods=['GET'])
@require_auth
def check_auth():
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
        problems_count = len(list(db.collection('problems').stream()))

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
        total_problems = len(list(db.collection('problems').stream()))

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
                except Exception:
                    pass

        return jsonify({
            'totalUsers': total_users,
            'totalProblems': total_problems,
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
        total_problems = len(list(db.collection('problems').stream()))

        for doc in db.collection('users').where('role', '==', 'user').stream():
            u = doc.to_dict()
            is_active = False
            if u.get('last_active'):
                try:
                    last_active_time = datetime.fromisoformat(u['last_active'])
                    if (current_time - last_active_time).seconds <= 300:
                        is_active = True
                except Exception:
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
                'total_problems': total_problems
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
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/heartbeat', methods=['POST'])
@require_auth
def user_heartbeat():
    db.collection('users').document(request.uid).update({'last_active': datetime.now().isoformat()})
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
            except Exception:
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
import re

actual_output = None
output_capture = io.StringIO()
sys.stdout = output_capture

_input_values = []
_input_index = 0

def parse_input(input_str):
    if not input_str:
        return []
    
    # This regex splits by any whitespace (spaces, tabs, newlines)
    # It ensures that "1 2" becomes ["1", "2"]
    parts = re.split(r'\\s+', input_str.strip())
    
    result = []
    for part in parts:
        if part:
            try:
                result.append(ast.literal_eval(part))
            except Exception:
                result.append(part)
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
    found_function = False
    
    if 'solution' in dir():
        func = eval('solution')
        found_function = True
        try:
            # Dynamically pass all whitespace-separated parts as arguments
            result = func(*input_values)
            
            if isinstance(result, bool):
                actual_output = str(result).lower()
            elif isinstance(result, list):
                actual_output = str(result)
            else:
                actual_output = str(result)
        except Exception as e:
            actual_output = f"Error calling function: {{str(e)}}"
            
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
                        except Exception:
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
                except Exception:
                    pass

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
                except Exception:
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
        return jsonify({'problems': problems})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'}), 200

if __name__ == '__main__':
    app.run(debug=False, port=5000, host='0.0.0.0')