"""
JARVIS Problem Solver - Step-by-Step Solutions
"""

from typing import Dict, List, Any, Optional
import json

class ProblemSolver:
    def __init__(self, brain):
        self.brain = brain
    
    async def solve(self, problem: str, context: Optional[List] = None) -> Dict:
        """Solve a problem with step-by-step approach"""
        
        # Analyze problem type
        problem_type = self._classify_problem(problem)
        
        # Generate solution based on type
        if problem_type == "math":
            return await self._solve_math(problem)
        elif problem_type == "code":
            return await self._solve_code(problem)
        elif problem_type == "logic":
            return await self._solve_logic(problem)
        elif problem_type == "troubleshoot":
            return await self._solve_troubleshoot(problem)
        else:
            return await self._solve_general(problem, context)
    
    def _classify_problem(self, problem: str) -> str:
        """Classify problem type"""
        
        problem_lower = problem.lower()
        
        # Math indicators
        math_keywords = ["calculate", "compute", "solve", "equation", "formula",
                        "sum", "difference", "product", "divide", "percentage",
                        "area", "volume", "circumference", "+", "-", "*", "/", "="]
        if any(kw in problem_lower for kw in math_keywords):
            return "math"
        
        # Code indicators
        code_keywords = ["code", "program", "function", "script", "debug",
                        "error", "exception", "syntax", "python", "javascript",
                        "implement", "algorithm", "class", "method"]
        if any(kw in problem_lower for kw in code_keywords):
            return "code"
        
        # Logic indicators
        logic_keywords = ["if", "then", "therefore", "puzzle", "riddle",
                         "logic", "reasoning", "deduce", "conclude"]
        if any(kw in problem_lower for kw in logic_keywords):
            return "logic"
        
        # Troubleshoot indicators
        troubleshoot_keywords = ["not working", "fix", "broken", "issue",
                                "problem with", "help me", "why does", "why won't",
                                "troubleshoot", "diagnose"]
        if any(kw in problem_lower for kw in troubleshoot_keywords):
            return "troubleshoot"
        
        return "general"
    
    async def _solve_math(self, problem: str) -> Dict:
        """Solve math problem"""
        
        prompt = f"""Solve this math problem step by step:

Problem: {problem}

Provide:
1. Break down the problem
2. Show each calculation step
3. Give the final answer
4. Verify the answer if possible

Format clearly with steps numbered."""

        solution = self.brain.chat(problem, context=[{"message": prompt, "response": ""}])
        
        return {
            "type": "math",
            "approach": "step-by-step calculation",
            "solution": solution,
            "problem": problem
        }
    
    async def _solve_code(self, problem: str) -> Dict:
        """Solve coding problem"""
        
        prompt = f"""Help with this coding problem:

Problem: {problem}

Provide:
1. Understand the requirements
2. Explain the approach/algorithm
3. Write the code solution
4. Add comments explaining key parts
5. Mention any edge cases to consider

Use proper code formatting."""

        solution = self.brain.chat(problem, context=[{"message": prompt, "response": ""}])
        
        return {
            "type": "code",
            "approach": "algorithmic solution",
            "solution": solution,
            "problem": problem
        }
    
    async def _solve_logic(self, problem: str) -> Dict:
        """Solve logic problem"""
        
        prompt = f"""Solve this logic problem:

Problem: {problem}

Provide:
1. Identify the given information
2. Identify what we need to find
3. Apply logical reasoning step by step
4. Draw conclusions
5. State the final answer

Be clear and methodical."""

        solution = self.brain.chat(problem, context=[{"message": prompt, "response": ""}])
        
        return {
            "type": "logic",
            "approach": "logical reasoning",
            "solution": solution,
            "problem": problem
        }
    
    async def _solve_troubleshoot(self, problem: str) -> Dict:
        """Troubleshoot a problem"""
        
        prompt = f"""Help troubleshoot this issue:

Issue: {problem}

Provide:
1. Identify possible causes (most likely first)
2. Diagnostic steps to pinpoint the issue
3. Solution for each possible cause
4. Prevention tips for the future

Be practical and clear."""

        solution = self.brain.chat(problem, context=[{"message": prompt, "response": ""}])
        
        return {
            "type": "troubleshoot",
            "approach": "diagnostic troubleshooting",
            "solution": solution,
            "problem": problem
        }
    
    async def _solve_general(self, problem: str, context: Optional[List] = None) -> Dict:
        """General problem solving"""
        
        prompt = f"""Help with this problem:

Problem: {problem}

Provide a clear, helpful solution with:
1. Understanding of the problem
2. Step-by-step approach
3. Practical solution
4. Additional tips if relevant"""

        solution = self.brain.chat(problem, context=context)
        
        return {
            "type": "general",
            "approach": "comprehensive analysis",
            "solution": solution,
            "problem": problem
        }