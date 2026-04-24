from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import subprocess
import tempfile
import os
import sys
import json
import traceback
import ast
from datetime import datetime
import hashlib
from collections import defaultdict

app = Flask(__name__, static_folder='../public', static_url_path='')
app.secret_key = 'your-secret-key-here-change-in-production'

# Initialize extensions
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Enable CORS
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

EXECUTION_TIMEOUT = 10

# Track active users (user_id -> last activity timestamp)
active_users = {}

# User database with progress tracking
class User(UserMixin):
    def __init__(self, id, username, email, password_hash, role, created_at, progress=None, last_active=None):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at
        self.progress = progress or {}
        self.last_active = last_active

# File-based user database
def load_users():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    users_path = os.path.join(project_root, 'data', 'users.json')
    
    if not os.path.exists(users_path):
        # Create default users
        default_users = {
            "users": {
                "1": {
                    "id": "1",
                    "username": "admin",
                    "email": "admin@codearena.com",
                    "password_hash": bcrypt.generate_password_hash('admin123').decode('utf-8'),
                    "role": "admin",
                    "created_at": datetime.now().isoformat(),
                    "progress": {},
                    "last_active": None
                },
                "2": {
                    "id": "2",
                    "username": "user",
                    "email": "user@example.com",
                    "password_hash": bcrypt.generate_password_hash('user123').decode('utf-8'),
                    "role": "user",
                    "created_at": datetime.now().isoformat(),
                    "progress": {},
                    "last_active": None
                }
            }
        }
        os.makedirs(os.path.dirname(users_path), exist_ok=True)
        with open(users_path, 'w', encoding='utf-8') as f:
            json.dump(default_users, f, indent=2)
        return default_users["users"]
    
    with open(users_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return data["users"]

def save_users(users_dict):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    users_path = os.path.join(project_root, 'data', 'users.json')
    
    with open(users_path, 'w', encoding='utf-8') as f:
        json.dump({"users": users_dict}, f, indent=2)

# Load users into memory
users = {}
for user_id, user_data in load_users().items():
    users[user_id] = User(
        user_data["id"],
        user_data["username"],
        user_data["email"],
        user_data["password_hash"],
        user_data["role"],
        user_data["created_at"],
        user_data.get("progress", {}),
        user_data.get("last_active")
    )

@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)

# Update user last active timestamp
def update_user_activity(user_id):
    if user_id in users:
        users[user_id].last_active = datetime.now().isoformat()
        active_users[user_id] = datetime.now()
        # Save to file
        users_dict = {}
        for uid, u in users.items():
            users_dict[uid] = {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "password_hash": u.password_hash,
                "role": u.role,
                "created_at": u.created_at,
                "progress": u.progress,
                "last_active": u.last_active
            }
        save_users(users_dict)

# Helper functions for problems
def load_problems():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    problems_path = os.path.join(project_root, 'data', 'problems.json')
    
    if not os.path.exists(problems_path):
        default_problems = {
            "problems": [
                {
                    "id": 1,
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
                    "examples": [
                        {
                            "input": "nums = [2,7,11,15], target = 9",
                            "output": "[0,1]",
                            "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]"
                        }
                    ],
                    "constraints": [
                        "2 <= nums.length <= 10^4",
                        "-10^9 <= nums[i] <= 10^9",
                        "-10^9 <= target <= 10^9"
                    ],
                    "starterCode": "def two_sum(nums, target):\n    # Write your code here\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []",
                    "testCases": [
                        {"input": "[2,7,11,15]\n9", "expected": "[0, 1]"},
                        {"input": "[3,2,4]\n6", "expected": "[1, 2]"},
                        {"input": "[3,3]\n6", "expected": "[0, 1]"}
                    ]
                }
            ]
        }
        os.makedirs(os.path.dirname(problems_path), exist_ok=True)
        with open(problems_path, 'w', encoding='utf-8') as f:
            json.dump(default_problems, f, indent=2)
        return default_problems
    
    with open(problems_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_problems(problems_data):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    problems_path = os.path.join(project_root, 'data', 'problems.json')
    
    os.makedirs(os.path.dirname(problems_path), exist_ok=True)
    
    with open(problems_path, 'w', encoding='utf-8') as f:
        json.dump(problems_data, f, indent=2)

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('../public', 'index.html')

@app.route('/admin')
def serve_admin():
    return send_from_directory('../public', 'admin.html')

@app.route('/login.html')
def serve_login():
    return send_from_directory('../public', 'login.html')

@app.route('/signup.html')
def serve_signup():
    return send_from_directory('../public', 'signup.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../public', path)

# Authentication routes
@app.route('/api/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Check if username exists
        for user in users.values():
            if user.username == username:
                return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        # Check if email exists
        for user in users.values():
            if user.email == email:
                return jsonify({'success': False, 'message': 'Email already exists'}), 400
        
        # Create new user
        new_id = str(max(int(id) for id in users.keys()) + 1)
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
        new_user = User(
            new_id,
            username,
            email,
            password_hash,
            'user',
            datetime.now().isoformat(),
            {},
            None
        )
        
        users[new_id] = new_user
        
        # Save to file
        users_dict = {}
        for uid, u in users.items():
            users_dict[uid] = {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "password_hash": u.password_hash,
                "role": u.role,
                "created_at": u.created_at,
                "progress": u.progress,
                "last_active": u.last_active
            }
        save_users(users_dict)
        
        # Auto login after signup
        login_user(new_user)
        update_user_activity(new_id)
        
        return jsonify({
            'success': True,
            'role': 'user',
            'username': username,
            'message': 'Account created successfully!'
        })
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
        
        # Find user
        user = None
        for u in users.values():
            if u.username == username and u.role == role:
                user = u
                break
        
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user)
            update_user_activity(user.id)
            return jsonify({
                'success': True,
                'role': user.role,
                'username': user.username,
                'message': f'Welcome back {username}!'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid credentials'
            }), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    # Remove from active users
    if current_user.id in active_users:
        del active_users[current_user.id]
    logout_user()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        # Update activity on each check
        update_user_activity(current_user.id)
        return jsonify({
            'authenticated': True,
            'role': current_user.role,
            'username': current_user.username
        })
    return jsonify({'authenticated': False})

# User progress routes
@app.route('/api/user/progress', methods=['GET'])
@login_required
def get_user_progress():
    try:
        progress = current_user.progress
        problems_data = load_problems()
        
        # Calculate statistics
        total_problems = len(problems_data['problems'])
        solved_problems = len([p for p in progress.values() if p.get('solved', False)])
        
        # Get solved problem IDs
        solved_ids = [int(pid) for pid, p in progress.items() if p.get('solved', False)]
        
        return jsonify({
            'progress': progress,
            'stats': {
                'total': total_problems,
                'solved': solved_problems,
                'percentage': (solved_problems / total_problems * 100) if total_problems > 0 else 0
            },
            'solvedIds': solved_ids
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/progress', methods=['POST'])
@login_required
def update_user_progress():
    try:
        data = request.json
        problem_id = str(data.get('problemId'))
        solved = data.get('solved', False)
        
        if problem_id not in current_user.progress:
            current_user.progress[problem_id] = {}
        
        current_user.progress[problem_id]['solved'] = solved
        current_user.progress[problem_id]['last_attempt'] = datetime.now().isoformat()
        
        if solved and 'solved_at' not in current_user.progress[problem_id]:
            current_user.progress[problem_id]['solved_at'] = datetime.now().isoformat()
        
        # Save to file
        users_dict = {}
        for uid, u in users.items():
            users_dict[uid] = {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "password_hash": u.password_hash,
                "role": u.role,
                "created_at": u.created_at,
                "progress": u.progress,
                "last_active": u.last_active
            }
        save_users(users_dict)
        
        return jsonify({'success': True, 'progress': current_user.progress[problem_id]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin routes
@app.route('/api/admin/stats', methods=['GET'])
@login_required
def admin_get_stats():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        total_users = len([u for u in users.values() if u.role == 'user'])
        total_problems = len(load_problems()['problems'])
        
        # Calculate total submissions (unique solved problems)
        total_solved = 0
        for u in users.values():
            if u.role == 'user':
                total_solved += len([p for p in u.progress.values() if p.get('solved', False)])
        
        # Clean up inactive users (older than 5 minutes)
        current_time = datetime.now()
        active_count = 0
        for user_id, last_active in list(active_users.items()):
            if (current_time - last_active).seconds > 300:  # 5 minutes timeout
                del active_users[user_id]
            else:
                # Check if user is a regular user (not admin)
                if user_id in users and users[user_id].role == 'user':
                    active_count += 1
        
        return jsonify({
            'totalUsers': total_users,
            'totalProblems': total_problems,
            'totalSubmissions': total_solved,
            'activeUsers': active_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@login_required
def admin_get_users():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        users_list = []
        current_time = datetime.now()
        total_problems = len(load_problems()['problems'])
        
        for u in users.values():
            if u.role == 'user':
                # Check if user is active (last activity within 5 minutes)
                is_active = False
                if u.id in active_users:
                    last_active = active_users[u.id]
                    if (current_time - last_active).seconds <= 300:
                        is_active = True
                elif u.last_active:
                    try:
                        last_active_time = datetime.fromisoformat(u.last_active)
                        if (current_time - last_active_time).seconds <= 300:
                            is_active = True
                    except:
                        pass
                
                # Get solved problems with details
                solved_problems = []
                for problem_id, progress in u.progress.items():
                    if progress.get('solved', False):
                        solved_problems.append({
                            'problem_id': int(problem_id),
                            'solved_at': progress.get('solved_at'),
                            'last_attempt': progress.get('last_attempt')
                        })
                
                users_list.append({
                    'id': u.id,
                    'username': u.username,
                    'email': u.email,
                    'created_at': u.created_at,
                    'solved_count': len(solved_problems),
                    'solved_problems': solved_problems,
                    'is_active': is_active,
                    'last_active': u.last_active,
                    'progress': u.progress,
                    'total_problems': total_problems
                })
        return jsonify({'users': users_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems', methods=['GET'])
@login_required
def admin_get_problems():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        problems_data = load_problems()
        
        # Add solved counts for each problem
        for problem in problems_data['problems']:
            solved_count = 0
            for u in users.values():
                if u.role == 'user' and u.progress.get(str(problem['id']), {}).get('solved', False):
                    solved_count += 1
            problem['solved_by_count'] = solved_count
        
        return jsonify(problems_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems', methods=['POST'])
@login_required
def admin_add_problem():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        problems_data = load_problems()
        new_problem = request.json
        
        # Generate new ID
        max_id = max([p.get('id', 0) for p in problems_data.get('problems', [])], default=0)
        new_problem['id'] = max_id + 1
        
        problems_data['problems'].append(new_problem)
        save_problems(problems_data)
        
        return jsonify({'success': True, 'problem': new_problem})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems/<int:problem_id>', methods=['PUT'])
@login_required
def admin_update_problem(problem_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        problems_data = load_problems()
        updated_problem = request.json
        
        for i, problem in enumerate(problems_data['problems']):
            if problem['id'] == problem_id:
                updated_problem['id'] = problem_id
                problems_data['problems'][i] = updated_problem
                save_problems(problems_data)
                return jsonify({'success': True, 'problem': updated_problem})
        
        return jsonify({'error': 'Problem not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/problems/<int:problem_id>', methods=['DELETE'])
@login_required
def admin_delete_problem(problem_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        problems_data = load_problems()
        problems_data['problems'] = [p for p in problems_data['problems'] if p['id'] != problem_id]
        save_problems(problems_data)
        return jsonify({'success': True, 'message': 'Problem deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/heartbeat', methods=['POST'])
@login_required
def user_heartbeat():
    """Update user's last active timestamp"""
    update_user_activity(current_user.id)
    return jsonify({'success': True})

# User code execution routes
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
        
        # Update user progress if all tests passed and user is logged in
        if all_passed and current_user.is_authenticated and current_user.role == 'user':
            try:
                problem_id_str = str(problem_id)
                if problem_id_str not in current_user.progress:
                    current_user.progress[problem_id_str] = {}
                
                current_user.progress[problem_id_str]['solved'] = True
                current_user.progress[problem_id_str]['last_attempt'] = datetime.now().isoformat()
                
                if 'solved_at' not in current_user.progress[problem_id_str]:
                    current_user.progress[problem_id_str]['solved_at'] = datetime.now().isoformat()
                
                # Save to file
                users_dict = {}
                for uid, u in users.items():
                    users_dict[uid] = {
                        "id": u.id,
                        "username": u.username,
                        "email": u.email,
                        "password_hash": u.password_hash,
                        "role": u.role,
                        "created_at": u.created_at,
                        "progress": u.progress,
                        "last_active": u.last_active
                    }
                save_users(users_dict)
            except Exception as e:
                print(f"Error updating progress: {e}")
        
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
        problems_data = load_problems()
        return jsonify(problems_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'}), 200

if __name__ == '__main__':
    print("🚀 Server starting...")
    print("📍 Project Structure:")
    print("   - API Server: api/index.py")
    print("   - Public Files: public/")
    print("   - Data Files: data/")
    print("\n📍 Access URLs:")
    print("   - Login Page: http://localhost:5000/login.html")
    print("   - Signup Page: http://localhost:5000/signup.html")
    print("   - User Interface: http://localhost:5000")
    print("   - Admin Interface: http://localhost:5000/admin")
    print("\n📝 Default Login Credentials:")
    print("   👤 User:  username='user', password='user123'")
    print("   👑 Admin: username='admin', password='admin123'")
    print("\n✅ Server is ready!")
    app.run(debug=True, port=5000, host='0.0.0.0')