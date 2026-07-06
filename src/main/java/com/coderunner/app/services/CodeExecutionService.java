package com.coderunner.app.services;

import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.Files;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Arrays;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class CodeExecutionService {

    private static final int EXECUTION_TIMEOUT = 10;
    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> executeCode(String code, String userInput) {
        return executeCode(code, userInput, "python");
    }

    public Map<String, Object> executeCode(String code, String userInput, String language) {
        if ("cpp".equalsIgnoreCase(language)) {
            return executeCpp(code, userInput);
        } else if ("java".equalsIgnoreCase(language)) {
            return executeJava(code, userInput);
        } else {
            return executePython(code, userInput);
        }
    }

    private Map<String, Object> executePython(String code, String userInput) {
        Map<String, Object> result = new HashMap<>();
        File tempFile = null;
        try {
            tempFile = File.createTempFile("exec", ".py");
            String wrapperCode = buildRunWrapper(code);
            Files.writeString(tempFile.toPath(), wrapperCode);

            ProcessBuilder pb = new ProcessBuilder("python3", tempFile.getAbsolutePath());
            pb.redirectErrorStream(true);
            Process process = pb.start();

            if (userInput != null && !userInput.isEmpty()) {
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
                writer.write(userInput);
                writer.close();
            }

            boolean finished = process.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                result.put("error", true);
                result.put("output", "Error: Code execution timed out");
                return result;
            }

            String output = new String(process.getInputStream().readAllBytes()).trim();
            result.put("error", process.exitValue() != 0);
            result.put("output", output.isEmpty() ? "Code executed successfully (no output)" : output);

        } catch (Exception e) {
            result.put("error", true);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (tempFile != null) tempFile.delete();
        }
        return result;
    }

    private Map<String, Object> executeCpp(String code, String userInput) {
        Map<String, Object> result = new HashMap<>();
        File tempDir = null;
        File sourceFile = null;
        File binFile = null;
        try {
            tempDir = Files.createTempDirectory("cpp_exec").toFile();
            sourceFile = new File(tempDir, "solution.cpp");
            binFile = new File(tempDir, "solution_bin");
            Files.writeString(sourceFile.toPath(), code);

            ProcessBuilder compileBuilder = new ProcessBuilder("g++", "-O3", "-std=c++17", sourceFile.getAbsolutePath(), "-o", binFile.getAbsolutePath());
            compileBuilder.redirectErrorStream(true);
            Process compileProcess = compileBuilder.start();
            boolean compileFinished = compileProcess.waitFor(30, TimeUnit.SECONDS);
            if (!compileFinished) {
                compileProcess.destroyForcibly();
                result.put("error", true);
                result.put("output", "Compilation timed out");
                return result;
            }

            if (compileProcess.exitValue() != 0) {
                String compileErrors = new String(compileProcess.getInputStream().readAllBytes()).trim();
                result.put("error", true);
                result.put("output", "Compilation Error:\n" + compileErrors);
                return result;
            }

            ProcessBuilder runBuilder = new ProcessBuilder(binFile.getAbsolutePath());
            runBuilder.redirectErrorStream(true);
            Process runProcess = runBuilder.start();

            if (userInput != null && !userInput.isEmpty()) {
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(runProcess.getOutputStream()));
                writer.write(userInput);
                writer.close();
            }

            boolean finished = runProcess.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);
            if (!finished) {
                runProcess.destroyForcibly();
                result.put("error", true);
                result.put("output", "Error: Code execution timed out");
                return result;
            }

            String output = new String(runProcess.getInputStream().readAllBytes()).trim();
            result.put("error", runProcess.exitValue() != 0);
            result.put("output", output.isEmpty() ? "Code executed successfully (no output)" : output);

        } catch (Exception e) {
            result.put("error", true);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (sourceFile != null) sourceFile.delete();
            if (binFile != null) binFile.delete();
            if (tempDir != null) tempDir.delete();
        }
        return result;
    }

    private Map<String, Object> executeJava(String code, String userInput) {
        Map<String, Object> result = new HashMap<>();
        File tempDir = null;
        File sourceFile = null;
        try {
            tempDir = Files.createTempDirectory("java_exec").toFile();
            
            String className = "Solution";
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("public\\s+class\\s+(\\w+)").matcher(code);
            if (m.find()) {
                className = m.group(1);
            }
            
            sourceFile = new File(tempDir, className + ".java");
            Files.writeString(sourceFile.toPath(), code);

            ProcessBuilder compileBuilder = new ProcessBuilder("javac", sourceFile.getAbsolutePath());
            compileBuilder.redirectErrorStream(true);
            Process compileProcess = compileBuilder.start();
            boolean compileFinished = compileProcess.waitFor(30, TimeUnit.SECONDS);
            if (!compileFinished) {
                compileProcess.destroyForcibly();
                result.put("error", true);
                result.put("output", "Compilation timed out");
                return result;
            }

            if (compileProcess.exitValue() != 0) {
                String compileErrors = new String(compileProcess.getInputStream().readAllBytes()).trim();
                result.put("error", true);
                result.put("output", "Compilation Error:\n" + compileErrors);
                return result;
            }

            ProcessBuilder runBuilder = new ProcessBuilder("java", "-cp", tempDir.getAbsolutePath(), className);
            runBuilder.redirectErrorStream(true);
            Process runProcess = runBuilder.start();

            if (userInput != null && !userInput.isEmpty()) {
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(runProcess.getOutputStream()));
                writer.write(userInput);
                writer.close();
            }

            boolean finished = runProcess.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);
            if (!finished) {
                runProcess.destroyForcibly();
                result.put("error", true);
                result.put("output", "Error: Code execution timed out");
                return result;
            }

            String output = new String(runProcess.getInputStream().readAllBytes()).trim();
            result.put("error", runProcess.exitValue() != 0);
            result.put("output", output.isEmpty() ? "Code executed successfully (no output)" : output);

        } catch (Exception e) {
            result.put("error", true);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (sourceFile != null) sourceFile.delete();
            if (tempDir != null) {
                File[] classFiles = tempDir.listFiles((dir, name) -> name.endsWith(".class"));
                if (classFiles != null) {
                    for (File f : classFiles) f.delete();
                }
                tempDir.delete();
            }
        }
        return result;
    }

    private String buildRunWrapper(String code) {
        String indentedCode = code.replaceAll("(?m)^", "    ");

        return "import builtins\n" +
               "import sys\n" +
               "import io\n" +
               "import traceback\n" +
               "output_capture = io.StringIO()\n" +
               "sys.stdout = output_capture\n" +
               "_original_input = builtins.input\n" +
               "def _custom_input(prompt=''):\n" +
               "    try:\n" +
               "        return _original_input()\n" +
               "    except EOFError:\n" +
               "        return ''\n" +
               "builtins.input = _custom_input\n" +
               "try:\n" +
               indentedCode + "\n" +
               "except Exception as e:\n" +
               "    print(f'Error: {e}')\n" +
               "    traceback.print_exc()\n" +
               "sys.stdout = sys.__stdout__\n" +
               "print(output_capture.getvalue())\n";
    }

    public Map<String, Object> submitSolution(String code, String testInput, String expectedOutput) {
        return submitSolution(code, testInput, expectedOutput, "python");
    }

    public Map<String, Object> submitSolution(String code, String testInput, String expectedOutput, String language) {
        if ("cpp".equalsIgnoreCase(language)) {
            return submitCpp(code, testInput, expectedOutput);
        } else if ("java".equalsIgnoreCase(language)) {
            return submitJava(code, testInput, expectedOutput);
        } else {
            return submitPython(code, testInput, expectedOutput);
        }
    }

    private Map<String, Object> submitPython(String code, String testInput, String expectedOutput) {
        Map<String, Object> result = new HashMap<>();
        File tempFile = null;
        try {
            tempFile = File.createTempFile("test", ".py");
            String escapedCode = code.replace("'''", "\\'\\'\\'").replace("\\", "\\\\");
            String escapedInput = testInput.replace("'''", "\\'\\'\\'").replace("\\", "\\\\");
            
            String testWrapper = "import builtins\n" +
                    "import sys\n" +
                    "import io\n" +
                    "import json\n" +
                    "import traceback\n" +
                    "import ast\n" +
                    "import re\n" +
                    "actual_output = None\n" +
                    "output_capture = io.StringIO()\n" +
                    "sys.stdout = output_capture\n" +
                    "_input_index = 0\n" +
                    "def parse_input(input_str):\n" +
                    "    if not input_str or not input_str.strip():\n" +
                    "        return []\n" +
                    "    s = input_str.strip()\n" +
                    "    args = []\n" +
                    "    depth = 0\n" +
                    "    in_str = False\n" +
                    "    str_char = ''\n" +
                    "    current = []\n" +
                    "    i = 0\n" +
                    "    while i < len(s):\n" +
                    "        c = s[i]\n" +
                    "        if in_str:\n" +
                    "            current.append(c)\n" +
                    "            if c == '\\\\' and i + 1 < len(s):\n" +
                    "                i += 1\n" +
                    "                current.append(s[i])\n" +
                    "            elif c == str_char:\n" +
                    "                in_str = False\n" +
                    "        elif c in ('\"', \"'\"):\n" +
                    "            in_str = True\n" +
                    "            str_char = c\n" +
                    "            current.append(c)\n" +
                    "        elif c in ('(', '[', '{'):\n" +
                    "            depth += 1\n" +
                    "            current.append(c)\n" +
                    "        elif c in (')', ']', '}'):\n" +
                    "            depth -= 1\n" +
                    "            current.append(c)\n" +
                    "        elif c == ',' and depth == 0:\n" +
                    "            part = ''.join(current).strip()\n" +
                    "            if part:\n" +
                    "                args.append(part)\n" +
                    "            current = []\n" +
                    "            i += 1\n" +
                    "            continue\n" +
                    "        else:\n" +
                    "            current.append(c)\n" +
                    "        i += 1\n" +
                    "    last = ''.join(current).strip()\n" +
                    "    if last:\n" +
                    "        args.append(last)\n" +
                    "    parsed = []\n" +
                    "    for arg in args:\n" +
                    "        try:\n" +
                    "            parsed.append(ast.literal_eval(arg))\n" +
                    "        except Exception:\n" +
                    "            parsed.append(arg)\n" +
                    "    return parsed\n" +
                    "try:\n" +
                    "    input_values = parse_input('''" + escapedInput + "''')\n" +
                    "except Exception as e:\n" +
                    "    input_values = []\n" +
                    "def _custom_input(prompt=''):\n" +
                    "    global _input_index\n" +
                    "    if _input_index < len(input_values):\n" +
                    "        val = input_values[_input_index]\n" +
                    "        _input_index += 1\n" +
                    "        return str(val) if not isinstance(val, str) else val\n" +
                    "    return ''\n" +
                    "builtins.input = _custom_input\n" +
                    "try:\n" +
                    "    exec('''" + escapedCode + "''')\n" +
                    "    found_function = False\n" +
                    "    if 'solution' in dir():\n" +
                    "        func = eval('solution')\n" +
                    "        found_function = True\n" +
                    "        try:\n" +
                    "            result = func(*input_values)\n" +
                    "            def _format_result(val):\n" +
                    "                if val is None:\n" +
                    "                    return 'null'\n" +
                    "                if isinstance(val, bool):\n" +
                    "                    return str(val).lower()\n" +
                    "                if isinstance(val, (list, tuple, set)):\n" +
                    "                    return '[' + ','.join(_format_result(x) for x in val) + ']'\n" +
                    "                if isinstance(val, dict):\n" +
                    "                    return '{' + ','.join(_format_result(k) + ':' + _format_result(v) for k, v in val.items()) + '}'\n" +
                    "                if isinstance(val, str):\n" +
                    "                    return '\"' + val + '\"'\n" +
                    "                return str(val)\n" +
                    "            actual_output = _format_result(result)\n" +
                    "        except Exception as e:\n" +
                    "            actual_output = f'Error calling function: {str(e)}'\n" +
                    "    if not found_function:\n" +
                    "        actual_output = output_capture.getvalue().strip()\n" +
                    "        if not actual_output:\n" +
                    "            actual_output = 'No output generated'\n" +
                    "except Exception as e:\n" +
                    "    actual_output = f'Error: {str(e)}'\n" +
                    "sys.stdout = sys.__stdout__\n" +
                    "print(actual_output)\n";

            Files.writeString(tempFile.toPath(), testWrapper);
            
            ProcessBuilder pb = new ProcessBuilder("python3", tempFile.getAbsolutePath());
            Process process = pb.start();
            boolean finished = process.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                result.put("passed", false);
                result.put("output", "Timeout");
                return result;
            }

            String output = new String(process.getInputStream().readAllBytes()).trim();
            String[] lines = output.split("\n");
            String actualOutput = lines.length > 0 ? lines[lines.length - 1].trim() : "";
            
            result.put("output", actualOutput);
            result.put("passed", actualOutput.equals(expectedOutput.trim()));

        } catch (Exception e) {
            result.put("passed", false);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (tempFile != null) tempFile.delete();
        }
        return result;
    }

    private Map<String, Object> submitCpp(String code, String testInput, String expectedOutput) {
        Map<String, Object> result = new HashMap<>();
        File tempDir = null;
        File sourceFile = null;
        File binFile = null;
        try {
            tempDir = Files.createTempDirectory("cpp_submit").toFile();
            sourceFile = new File(tempDir, "solution.cpp");
            binFile = new File(tempDir, "solution_bin");

            List<Object> args = mapper.readValue("[" + testInput + "]", new TypeReference<List<Object>>() {});
            StringBuilder callArgs = new StringBuilder();
            String decls = generateCppArgs(args, callArgs);

            String driverCode = 
                "#include <iostream>\n" +
                "#include <vector>\n" +
                "#include <string>\n" +
                "#include <sstream>\n" +
                "\n" +
                code + "\n\n" +
                "template<typename T>\n" +
                "void print_result(const std::vector<T>& val);\n" +
                "\n" +
                "void print_result(int val) { std::cout << val; }\n" +
                "void print_result(double val) { std::cout << val; }\n" +
                "void print_result(bool val) { std::cout << (val ? \"true\" : \"false\"); }\n" +
                "void print_result(const std::string& val) { std::cout << \"\\\"\" << val << \"\\\"\"; }\n" +
                "\n" +
                "template<typename T>\n" +
                "void print_result(const std::vector<T>& val) {\n" +
                "    std::cout << \"[\";\n" +
                "    for (size_t i = 0; i < val.size(); ++i) {\n" +
                "        if (i > 0) std::cout << \",\";\n" +
                "        print_result(val[i]);\n" +
                "    }\n" +
                "    std::cout << \"]\";\n" +
                "}\n" +
                "\n" +
                "int main() {\n" +
                "    Solution solver;\n" +
                decls +
                "    try {\n" +
                "        auto result = solver.solution(" + callArgs.toString() + ");\n" +
                "        print_result(result);\n" +
                "        std::cout << std::endl;\n" +
                "    } catch (const std::exception& e) {\n" +
                "        std::cout << \"Error: \" << e.what() << std::endl;\n" +
                "    } catch (...) {\n" +
                "        std::cout << \"Error occurred\" << std::endl;\n" +
                "    }\n" +
                "    return 0;\n" +
                "}\n";

            Files.writeString(sourceFile.toPath(), driverCode);

            ProcessBuilder compileBuilder = new ProcessBuilder("g++", "-O3", "-std=c++17", sourceFile.getAbsolutePath(), "-o", binFile.getAbsolutePath());
            compileBuilder.redirectErrorStream(true);
            Process compileProcess = compileBuilder.start();
            boolean compileFinished = compileProcess.waitFor(30, TimeUnit.SECONDS);
            if (!compileFinished) {
                compileProcess.destroyForcibly();
                result.put("passed", false);
                result.put("output", "Compilation Timeout");
                return result;
            }

            if (compileProcess.exitValue() != 0) {
                String compileErrors = new String(compileProcess.getInputStream().readAllBytes()).trim();
                result.put("passed", false);
                result.put("output", "Compilation Error:\n" + compileErrors);
                return result;
            }

            ProcessBuilder runBuilder = new ProcessBuilder(binFile.getAbsolutePath());
            runBuilder.redirectErrorStream(true);
            Process runProcess = runBuilder.start();
            boolean finished = runProcess.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);
            if (!finished) {
                runProcess.destroyForcibly();
                result.put("passed", false);
                result.put("output", "Timeout");
                return result;
            }

            String output = new String(runProcess.getInputStream().readAllBytes()).trim();
            result.put("output", output);
            result.put("passed", output.equals(expectedOutput.trim()));

        } catch (Exception e) {
            result.put("passed", false);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (sourceFile != null) sourceFile.delete();
            if (binFile != null) binFile.delete();
            if (tempDir != null) tempDir.delete();
        }
        return result;
    }

    private Map<String, Object> submitJava(String code, String testInput, String expectedOutput) {
        Map<String, Object> result = new HashMap<>();
        File tempDir = null;
        File sourceFile = null;
        File runnerFile = null;
        try {
            tempDir = Files.createTempDirectory("java_submit").toFile();
            sourceFile = new File(tempDir, "Solution.java");
            runnerFile = new File(tempDir, "Runner.java");

            Files.writeString(sourceFile.toPath(), code);

            List<Object> args = mapper.readValue("[" + testInput + "]", new TypeReference<List<Object>>() {});

            String runnerCode = 
                "import java.util.*;\n" +
                "\n" +
                "public class Runner {\n" +
                "    public static void main(String[] args) throws Exception {\n" +
                "        Solution solver = new Solution();\n" +
                "        List<Object> rawArgs = new ArrayList<>();\n";
            
            for (int i = 0; i < args.size(); i++) {
                runnerCode += "        rawArgs.add(" + getJavaValue(args.get(i)) + ");\n";
            }

            runnerCode += 
                "        java.lang.reflect.Method method = null;\n" +
                "        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {\n" +
                "            if (m.getName().equals(\"solution\")) {\n" +
                "                method = m;\n" +
                "                break;\n" +
                "            }\n" +
                "        }\n" +
                "        if (method == null) {\n" +
                "            System.out.println(\"Error: method solution not found\");\n" +
                "            return;\n" +
                "        }\n" +
                "        Class<?>[] paramTypes = method.getParameterTypes();\n" +
                "        Object[] converted = new Object[paramTypes.length];\n" +
                "        for (int i = 0; i < paramTypes.length; i++) {\n" +
                "            converted[i] = convertArg(rawArgs.get(i), paramTypes[i]);\n" +
                "        }\n" +
                "        try {\n" +
                "            Object result = method.invoke(solver, converted);\n" +
                "            printResult(result);\n" +
                "            System.out.println();\n" +
                "        } catch (java.lang.reflect.InvocationTargetException e) {\n" +
                "            System.out.println(\"Error: \" + e.getCause().getMessage());\n" +
                "        } catch (Exception e) {\n" +
                "            System.out.println(\"Error: \" + e.getMessage());\n" +
                "        }\n" +
                "    }\n" +
                "\n" +
                "    private static Object convertArg(Object arg, Class<?> targetType) {\n" +
                "        if (targetType.isInstance(arg)) {\n" +
                "            return arg;\n" +
                "        }\n" +
                "        if (arg instanceof Number) {\n" +
                "            if (targetType == int.class || targetType == Integer.class) return ((Number) arg).intValue();\n" +
                "            if (targetType == double.class || targetType == Double.class) return ((Number) arg).doubleValue();\n" +
                "            if (targetType == long.class || targetType == Long.class) return ((Number) arg).longValue();\n" +
                "            if (targetType == float.class || targetType == Float.class) return ((Number) arg).floatValue();\n" +
                "        }\n" +
                "        if (targetType == boolean.class || targetType == Boolean.class) {\n" +
                "            return (Boolean) arg;\n" +
                "        }\n" +
                "        if (targetType.isArray() && arg instanceof List) {\n" +
                "            List<?> list = (List<?>) arg;\n" +
                "            Class<?> componentType = targetType.getComponentType();\n" +
                "            Object array = java.lang.reflect.Array.newInstance(componentType, list.size());\n" +
                "            for (int i = 0; i < list.size(); i++) {\n" +
                "                java.lang.reflect.Array.set(array, i, convertArg(list.get(i), componentType));\n" +
                "            }\n" +
                "            return array;\n" +
                "        }\n" +
                "        if ((targetType == List.class || targetType == ArrayList.class) && arg instanceof List) {\n" +
                "            return new ArrayList<>((List<?>) arg);\n" +
                "        }\n" +
                "        return arg;\n" +
                "    }\n" +
                "\n" +
                "    private static void printResult(Object val) {\n" +
                "        if (val == null) {\n" +
                "            System.out.print(\"null\");\n" +
                "        } else if (val instanceof String) {\n" +
                "            System.out.print(\"\\\"\" + val + \"\\\"\");\n" +
                "        } else if (val instanceof Boolean) {\n" +
                "            System.out.print(val);\n" +
                "        } else if (val instanceof Number) {\n" +
                "            System.out.print(val);\n" +
                "        } else if (val instanceof Collection) {\n" +
                "            System.out.print(\"[\");\n" +
                "            boolean first = true;\n" +
                "            for (Object item : (Collection<?>) val) {\n" +
                "                if (!first) System.out.print(\",\");\n" +
                "                printResult(item);\n" +
                "                first = false;\n" +
                "            }\n" +
                "            System.out.print(\"]\");\n" +
                "        } else if (val.getClass().isArray()) {\n" +
                "            System.out.print(\"[\");\n" +
                "            int len = java.lang.reflect.Array.getLength(val);\n" +
                "            for (int i = 0; i < len; i++) {\n" +
                "                if (i > 0) System.out.print(\",\");\n" +
                "                printResult(java.lang.reflect.Array.get(val, i));\n" +
                "            }\n" +
                "            System.out.print(\"]\");\n" +
                "        } else {\n" +
                "            System.out.print(val.toString());\n" +
                "        }\n" +
                "    }\n" +
                "}\n";

            Files.writeString(runnerFile.toPath(), runnerCode);

            ProcessBuilder compileBuilder = new ProcessBuilder("javac", sourceFile.getAbsolutePath(), runnerFile.getAbsolutePath());
            compileBuilder.redirectErrorStream(true);
            Process compileProcess = compileBuilder.start();
            boolean compileFinished = compileProcess.waitFor(30, TimeUnit.SECONDS);
            if (!compileFinished) {
                compileProcess.destroyForcibly();
                result.put("passed", false);
                result.put("output", "Compilation Timeout");
                return result;
            }

            if (compileProcess.exitValue() != 0) {
                String compileErrors = new String(compileProcess.getInputStream().readAllBytes()).trim();
                result.put("passed", false);
                result.put("output", "Compilation Error:\n" + compileErrors);
                return result;
            }

            ProcessBuilder runBuilder = new ProcessBuilder("java", "-cp", tempDir.getAbsolutePath(), "Runner");
            runBuilder.redirectErrorStream(true);
            Process runProcess = runBuilder.start();
            boolean finished = runProcess.waitFor(EXECUTION_TIMEOUT, TimeUnit.SECONDS);
            if (!finished) {
                runProcess.destroyForcibly();
                result.put("passed", false);
                result.put("output", "Timeout");
                return result;
            }

            String output = new String(runProcess.getInputStream().readAllBytes()).trim();
            result.put("output", output);
            result.put("passed", output.equals(expectedOutput.trim()));

        } catch (Exception e) {
            result.put("passed", false);
            result.put("output", "Error: " + e.getMessage());
        } finally {
            if (sourceFile != null) sourceFile.delete();
            if (runnerFile != null) runnerFile.delete();
            if (tempDir != null) {
                File[] classFiles = tempDir.listFiles((dir, name) -> name.endsWith(".class"));
                if (classFiles != null) {
                    for (File f : classFiles) f.delete();
                }
                tempDir.delete();
            }
        }
        return result;
    }

    private String generateCppArgs(List<Object> args, StringBuilder callArgs) {
        StringBuilder decls = new StringBuilder();
        for (int i = 0; i < args.size(); i++) {
            if (i > 0) callArgs.append(", ");
            String varName = "arg" + i;
            callArgs.append(varName);
            decls.append("    ").append(getCppDeclaration(varName, args.get(i))).append(";\n");
        }
        return decls.toString();
    }

    private String getCppDeclaration(String varName, Object val) {
        if (val instanceof List) {
            List<?> list = (List<?>) val;
            if (list.isEmpty()) {
                return "std::vector<int> " + varName + " = {}";
            }
            Object first = list.get(0);
            String innerType = getCppType(first);
            StringBuilder sb = new StringBuilder();
            sb.append("std::vector<").append(innerType).append("> ").append(varName).append(" = {");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append(getCppValue(list.get(i)));
            }
            sb.append("}");
            return sb.toString();
        } else {
            return getCppType(val) + " " + varName + " = " + getCppValue(val);
        }
    }

    private String getCppType(Object val) {
        if (val instanceof Integer) return "int";
        if (val instanceof Long) return "long long";
        if (val instanceof Double || val instanceof Float) return "double";
        if (val instanceof Boolean) return "bool";
        if (val instanceof String) return "std::string";
        if (val instanceof List) {
            List<?> list = (List<?>) val;
            if (list.isEmpty()) return "std::vector<int>";
            return "std::vector<" + getCppType(list.get(0)) + ">";
        }
        return "std::string";
    }

    private String getCppValue(Object val) {
        if (val == null) return "0";
        if (val instanceof String) {
            return "\"" + val.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        }
        if (val instanceof Boolean) {
            return val.toString();
        }
        if (val instanceof List) {
            List<?> list = (List<?>) val;
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append(getCppValue(list.get(i)));
            }
            sb.append("}");
            return sb.toString();
        }
        return val.toString();
    }

    private String getJavaValue(Object val) {
        if (val == null) return "null";
        if (val instanceof String) {
            return "\"" + val.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        }
        if (val instanceof Boolean) {
            return val.toString();
        }
        if (val instanceof List) {
            List<?> list = (List<?>) val;
            StringBuilder sb = new StringBuilder();
            sb.append("Arrays.asList(");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append(getJavaValue(list.get(i)));
            }
            sb.append(")");
            return sb.toString();
        }
        return val.toString();
    }
}