#!/usr/bin/env python3
"""
WakaTime-Compatible Heartbeat Tester v9.1 - Dynamic Scanner + Weighted Sessions

Features:
- Dynamic roots: auto-detects git root, accepts CLI/env overrides
- Dynamic languages: auto-detects ratios from actual file counts
- Real files only with complexity scoring (0-100)
- Weighted sessions: complex files get deep focus, simple files get brief touches
- Mass cycling: 40-65 unique files/day with directory clustering
- Default editor: VS Code: (capitalization accurate)
- 24/7 auto-scheduling with realistic human patterns
- Correct Hackatime auth (base64(key) not base64(key:))
"""

import argparse
import base64
import hashlib
import json
import os
import platform
import random
import re
import subprocess
import sys
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Set, Dict

import requests

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

API_URL = "https://hackatime.hackclub.com/api/hackatime/v1"
API_KEY = "e48c32d3-7bea-4230-bea2-76c644e2ae11"
HEARTBEAT_RATE_LIMIT_SECONDS = 30

# Default editor set to exact capitalization requested
SPOOF_EDITOR = "VS Code:"
SPOOF_OS = "windows"
SPOOF_EDITOR_VERSION = "1.85.0"
SPOOF_PLUGIN_VERSION = "24.4.0"
SPOOF_OS_VERSION = "10.0.19045"
SPOOF_ARCH = "x86_64"

# ═══════════════════════════════════════════════════════════════════════════════
# SCHEDULE CONFIGURATION - 24/7 GHOST MODE
# ═══════════════════════════════════════════════════════════════════════════════

DAILY_TARGET_HOURS = 7.5
LUNCH_START = 12.5
LUNCH_END = 13.5
EVENING_START = 18.0
EVENING_END = 21.0
INSOMNIA_CHANCE = 0.25
INSOMNIA_START = 1.0
INSOMNIA_END = 4.0
INSOMNIA_INTENSITY = "intense"
WEEKEND_CODING_REDUCTION = 0.4
WEEKEND_CHAOS_FACTOR = 1.5

# ═══════════════════════════════════════════════════════════════════════════════
# SMART SCANNER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Extensions ranked by perceived complexity (higher = more complex)
EXTENSION_COMPLEXITY = {
    ".tsx": 85, ".ts": 80, ".py": 70, ".jsx": 65, ".js": 50,
    ".go": 75, ".rs": 80, ".java": 65, ".kt": 65, ".swift": 70,
    ".cpp": 75, ".c": 60, ".h": 55, ".hpp": 70,
    ".rb": 55, ".php": 50, ".cs": 60, ".scala": 70,
    ".sql": 45, ".sh": 40, ".bash": 40, ".zsh": 40, ".ps1": 35,
    ".tf": 50, ".hcl": 50,
    ".vue": 60, ".svelte": 65, ".astro": 55,
    ".html": 20, ".css": 15, ".scss": 25, ".sass": 20,
    ".json": 10, ".yaml": 10, ".yml": 10, ".toml": 10, ".ini": 5,
    ".md": 5,
}

# Directory name bonuses for complexity
DIR_COMPLEXITY_BONUSES = {
    "lib": 15, "auth": 20, "middleware": 18, "services": 15,
    "api": 15, "utils": 10, "core": 15, "engine": 15, "manager": 12,
    "handler": 12, "processor": 12, "controller": 14, "route": 12,
    "routes": 12, "graphql": 14, "websocket": 14, "algorithm": 16,
    "crypto": 18, "security": 16, "parser": 14, "compiler": 18,
    "agent": 14, "llm": 14, "ai": 12, "model": 10, "models": 10,
    "repository": 10, "repo": 10, "db": 10, "database": 10,
    "config": -5, "test": -20, "tests": -20, "spec": -20,
    "fixture": -15, "mock": -15, "mocks": -15, "stories": -10,
    "storybook": -10, "e2e": -15, "cypress": -15, "playwright": -15,
    "vitest": -15, "jest": -15, "__tests__": -20,
}

# Filename keyword bonuses/penalties
FILENAME_COMPLEXITY = {
    "auth": 12, "api": 10, "route": 10, "middleware": 12, "service": 10,
    "controller": 10, "engine": 12, "manager": 8, "handler": 8,
    "processor": 8, "parser": 10, "compiler": 14, "algorithm": 12,
    "crypto": 14, "security": 12, "encryption": 14, "hash": 10,
    "websocket": 10, "graphql": 10, "resolver": 10, "schema": 8,
    "agent": 10, "llm": 10, "model": 6, "inference": 10,
    "test": -15, "spec": -15, "fixture": -12, "mock": -12,
    "config": -5, "setup": -5, "teardown": -5, "index": -3,
    "types": 5, "interface": 5, "enum": 3, "constant": 2,
    "util": 5, "helper": 5, "wrapper": 5,
}

# Session duration ranges (minutes) by complexity tier
COMPLEXITY_TIERS = {
    (90, 100): (25, 40),
    (75, 89):  (15, 25),
    (60, 74):  (8, 15),
    (40, 59):  (3, 8),
    (20, 39):  (1, 3),
    (0, 19):   (0.5, 1.5),
}

# Language to extensions mapping (for auto-detection)
LANGUAGE_EXTENSIONS = {
    "TypeScript": [".ts", ".tsx"],
    "JavaScript": [".js", ".jsx"],
    "Python": [".py"],
    "Go": [".go"],
    "Rust": [".rs"],
    "Java": [".java"],
    "C++": [".cpp", ".hpp", ".cc"],
    "C": [".c", ".h"],
    "Swift": [".swift"],
    "Kotlin": [".kt"],
    "PHP": [".php"],
    "Ruby": [".rb"],
    "HTML": [".html"],
    "CSS": [".css", ".scss", ".sass"],
    "Markdown": [".md"],
    "JSON": [".json"],
    "YAML": [".yaml", ".yml"],
    "SQL": [".sql"],
    "Shell": [".sh", ".bash", ".zsh"],
    "HCL": [".tf", ".hcl"],
    "Vue": [".vue"],
    "Svelte": [".svelte"],
    "Astro": [".astro"],
}

# Extension to language mapping (reverse of above, single best match)
EXT_TO_LANGUAGE = {
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".cpp": "C++", ".cc": "C++", ".hpp": "C++",
    ".c": "C", ".h": "C",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".scala": "Scala",
    ".html": "HTML",
    ".css": "CSS", ".scss": "CSS", ".sass": "CSS",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML", ".yml": "YAML",
    ".sql": "SQL",
    ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell", ".ps1": "PowerShell",
    ".tf": "HCL", ".hcl": "HCL",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".astro": "Astro",
}

# How many unique files to target per day
DAILY_FILE_TARGET_MIN = 40
DAILY_FILE_TARGET_MAX = 65

# Don't revisit a file within this many minutes
RECENCY_COOLDOWN_MINUTES = 30
TOP_TIER_RECENCY_COOLDOWN_MINUTES = 10

# ═══════════════════════════════════════════════════════════════════════════════
# END CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    DIM = "\033[90m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def status_dot(color: str) -> str:
    return f"{color}●{Colors.RESET}"


def current_hour() -> float:
    now = datetime.now()
    return now.hour + now.minute / 60.0


def is_weekend() -> bool:
    return datetime.now().weekday() >= 5


@dataclass
class ScannedFile:
    entity: str
    project: str
    branch: str
    language: str
    lines: int
    complexity: float = 0.0
    last_modified: float = 0.0
    last_sent: float = 0.0
    familiarity: float = 0.0
    times_touched: int = 0
    total_time_minutes: float = 0.0
    session_end_time: float = 0.0
    session_duration_target: float = 0.0

    def can_send(self, now: float, is_write: bool, rate_limit: int = 30) -> bool:
        if is_write:
            return True
        return (now - self.last_sent) >= rate_limit

    def mark_sent(self, now: float):
        self.last_sent = now
        self.familiarity = min(1.0, self.familiarity + 0.05)
        self.times_touched += 1

    def is_in_session(self, now: float) -> bool:
        return now < self.session_end_time

    def start_session(self, now: float, duration_minutes: float):
        self.session_end_time = now + (duration_minutes * 60)
        self.session_duration_target = duration_minutes
        self.total_time_minutes += duration_minutes


class SpoofedFingerprint:
    def __init__(self, editor: str, editor_version: str, os_name: str):
        self.editor = editor
        self.editor_version = editor_version
        self.os_name = os_name
        self.hostname = self._spoof_hostname()
        self.machine_id = self._spoof_machine_id()
        self.mac_hash = self._spoof_mac_hash()
        self.timezone = self._spoof_timezone()
        self.os_info = self._spoof_os_info()
        self.user_agent = self._build_user_agent()

    def _spoof_hostname(self) -> str:
        if self.os_name == "windows":
            return random.choice(["DESKTOP-" + ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=7)),
                                  "LAPTOP-" + ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=7))])
        elif self.os_name == "macos":
            return random.choice(["MacBook-Pro.local", "MacBook-Air.local", "iMac.local"])
        else:
            return random.choice(["devbox", "workstation", "lenovo-x1"])

    def _spoof_machine_id(self) -> str:
        return uuid.uuid5(uuid.NAMESPACE_DNS, f"{self.os_name}-{self.hostname}-wakatime").hex[:32]

    def _spoof_mac_hash(self) -> str:
        fake_mac = ''.join(random.choices('0123456789abcdef', k=12))
        return hashlib.sha256(fake_mac.encode()).hexdigest()[:16]

    def _spoof_timezone(self) -> str:
        if self.os_name == "windows":
            return random.choice(["UTC-05:00", "UTC-08:00", "UTC+00:00", "UTC+01:00", "UTC+02:00", "UTC+09:00"])
        elif self.os_name == "macos":
            return random.choice(["UTC-08:00", "UTC-07:00", "UTC-05:00", "UTC+01:00"])
        else:
            return random.choice(["UTC+00:00", "UTC+01:00", "UTC+02:00", "UTC+05:30", "UTC+08:00", "UTC+09:00"])

    def _spoof_os_info(self) -> str:
        if self.os_name == "windows":
            return "windows"
        elif self.os_name == "macos":
            return "macos"
        else:
            return "linux"

    def _build_user_agent(self) -> str:
        editor_display = self.editor
        editor_lower = editor_display.lower().replace(" ", "").replace(":", "")

        if editor_lower in ("vscode", "vscodium"):
            slug = "vscode"
            plugin = "vscode-wakatime"
        elif editor_lower == "cursor":
            slug = "cursor"
            plugin = "cursor-wakatime"
        elif editor_lower in ("vim", "nvim", "neovim"):
            slug = "vim"
            plugin = "vim-wakatime"
        elif editor_lower == "sublime":
            slug = "sublime_text"
            plugin = "sublime-wakatime"
        elif editor_lower in ("intellij", "idea", "webstorm", "pycharm"):
            slug = "intellij"
            plugin = "intellij-wakatime"
        else:
            slug = editor_lower
            plugin = f"{editor_lower}-wakatime"

        return f"{slug}/{self.editor_version} ({self.os_info}) {plugin}/{SPOOF_PLUGIN_VERSION}"


class SmartScanner:
    def __init__(self, paths: List[str]):
        self.paths = paths
        self.files: List[ScannedFile] = []
        self.projects: Set[str] = set()
        self.files_by_project: Dict[str, List[ScannedFile]] = {}
        self.files_by_directory: Dict[str, List[ScannedFile]] = {}
        self.auto_lang_weights: Dict[str, float] = {}

    def _get_git_branch(self, filepath: Path) -> str:
        try:
            repo_root = filepath.parent
            for _ in range(10):
                if (repo_root / ".git").exists():
                    break
                repo_root = repo_root.parent
                if repo_root == repo_root.parent:
                    return "main"
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.strip() or "main"
        except:
            pass
        return "main"

    def _get_project_name(self, filepath: Path) -> str:
        try:
            repo_root = filepath.parent
            for _ in range(10):
                if (repo_root / ".git").exists():
                    break
                repo_root = repo_root.parent
                if repo_root == repo_root.parent:
                    return filepath.parent.name
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                url = result.stdout.strip()
                name = url.split("/")[-1].replace(".git", "")
                if name:
                    return name
        except:
            pass
        return filepath.parent.name

    def _score_complexity(self, filepath: Path, content: str, lines: int) -> float:
        score = 0.0
        path_str = str(filepath).lower()
        filename = filepath.stem.lower()
        ext = filepath.suffix.lower()

        score += EXTENSION_COMPLEXITY.get(ext, 30)
        depth = len(filepath.parts) - 1
        score += min(depth * 2, 15)

        for dir_name, bonus in DIR_COMPLEXITY_BONUSES.items():
            if f"/{dir_name}/" in path_str or f"\\{dir_name}\\" in path_str:
                score += bonus

        for keyword, bonus in FILENAME_COMPLEXITY.items():
            if keyword in filename:
                score += bonus

        if lines > 500:
            score += 10
        elif lines > 200:
            score += 7
        elif lines > 100:
            score += 4
        elif lines > 50:
            score += 2

        if content:
            import_count = len(re.findall(r'^(import|from|require|include|using|#include)', content, re.MULTILINE))
            if import_count > 15:
                score += 8
            elif import_count > 8:
                score += 5
            elif import_count > 3:
                score += 2

            func_count = len(re.findall(r'(function|def|class|const.*=.*\(|async def|interface|type\s+\w+)', content))
            if func_count > 20:
                score += 8
            elif func_count > 10:
                score += 5
            elif func_count > 5:
                score += 2

            complex_signals = [
                'recursive', 'algorithm', 'encryption', 'hash', 'websocket',
                'middleware', 'interceptor', 'decorator', 'generator',
                'async', 'await', 'Promise', 'Stream', 'Observable',
                'cache', 'memoize', 'throttle', 'debounce', 'sanitize',
                'validate', 'authenticate', 'authorize', 'permission',
                'transaction', 'migration', 'seed', 'factory',
            ]
            signal_count = sum(1 for s in complex_signals if s in content.lower())
            score += min(signal_count * 1.5, 10)

            if content.count('\n') < 10:
                score -= 10
            if 'TODO' in content or 'FIXME' in content:
                score += 3

        return max(0.0, min(100.0, score))

    def _get_session_duration(self, complexity: float) -> float:
        for (low, high), (min_dur, max_dur) in COMPLEXITY_TIERS.items():
            if low <= complexity <= high:
                return random.uniform(min_dur, max_dur)
        return random.uniform(0.5, 1.5)

    def scan(self) -> List[ScannedFile]:
        print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}  SMART SCANNER v9.1{Colors.RESET}")
        print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")

        target_extensions = set(EXTENSION_COMPLEXITY.keys())

        print(f"{Colors.DIM}Scanning {len(self.paths)} root(s) for files...{Colors.RESET}")

        for base_path in self.paths:
            path = Path(base_path).expanduser().resolve()
            if not path.exists():
                print(f"  {Colors.YELLOW}SKIP{Colors.RESET}: {path} (not found)")
                continue
            print(f"  {Colors.CYAN}SCAN{Colors.RESET}: {path}")
            self._scan_directory(path, target_extensions)

        self.files.sort(key=lambda f: f.complexity, reverse=True)

        for f in self.files:
            self.projects.add(f.project)
            if f.project not in self.files_by_project:
                self.files_by_project[f.project] = []
            self.files_by_project[f.project].append(f)

            dir_key = str(Path(f.entity).parent)
            if dir_key not in self.files_by_directory:
                self.files_by_directory[dir_key] = []
            self.files_by_directory[dir_key].append(f)

        self._compute_language_weights()
        self._print_distribution()

        print(f"\n  {Colors.GREEN}Found {len(self.files)} files{Colors.RESET} across "
              f"{Colors.CYAN}{len(self.projects)}{Colors.RESET} projects")
        print(f"  Auto-detected language ratios:")
        for lang, pct in sorted(self.auto_lang_weights.items(), key=lambda x: -x[1]):
            print(f"    {Colors.CYAN}{lang}{Colors.RESET}: {pct*100:.1f}%")
        print(f"  Editor: {Colors.CYAN}{SPOOF_EDITOR}{Colors.RESET} | OS: {Colors.CYAN}{SPOOF_OS}{Colors.RESET}")
        print(f"  Top 5 most complex files:")
        for i, f in enumerate(self.files[:5], 1):
            print(f"    {Colors.CYAN}{i}.{Colors.RESET} {f.entity.split('/')[-1]} "
                  f"{Colors.DIM}(score: {f.complexity:.1f}, target: {f.session_duration_target:.0f}m){Colors.RESET}")

        return self.files

    def _compute_language_weights(self):
        lang_counts: Dict[str, int] = {}
        for f in self.files:
            lang = f.language
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

        total = sum(lang_counts.values())
        if total == 0:
            self.auto_lang_weights = {"TypeScript": 1.0}
            return

        self.auto_lang_weights = {lang: count / total for lang, count in lang_counts.items()}
        total_weight = sum(self.auto_lang_weights.values())
        if total_weight > 0:
            self.auto_lang_weights = {k: v / total_weight for k, v in self.auto_lang_weights.items()}

    def _scan_directory(self, directory: Path, target_extensions: Set[str]):
        project_name = self._get_project_name(directory / "dummy")
        branch = self._get_git_branch(directory / "dummy") if (directory / ".git").exists() else "main"

        self.projects.add(project_name)

        try:
            for filepath in directory.rglob("*"):
                if not filepath.is_file():
                    continue
                if filepath.suffix.lower() not in target_extensions:
                    continue
                if any(part.startswith(".") for part in filepath.parts):
                    continue
                # Self-exclusion: never scan, edit, or report the spoofer script itself
                script_names = {
                    "hackatime_tester", "hackatime", "wakatime", "spoofer",
                    "heartbeat", "ghost",
                }
                filepath_lower = str(filepath).lower()
                filename_lower = filepath.name.lower()
                if any(name in filename_lower for name in script_names):
                    continue

                if any(skip in str(filepath) for skip in [
                    "node_modules", "__pycache__", ".git", "dist", "build",
                    "out", ".next", "coverage", ".vscode", ".idea", "venv",
                    "env", "target/debug", "target/release", "bin", "obj",
                ]):
                    continue

                content = ""
                lines = 0
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    lines = content.count("\n") + 1
                except:
                    lines = random.randint(10, 200)

                entity = str(filepath).replace("\\", "/")
                ext = filepath.suffix.lower()
                file_language = EXT_TO_LANGUAGE.get(ext, "Unknown")

                complexity = self._score_complexity(filepath, content, lines)
                session_target = self._get_session_duration(complexity)

                self.files.append(ScannedFile(
                    entity=entity,
                    project=project_name,
                    branch=branch,
                    language=file_language,
                    lines=lines,
                    complexity=complexity,
                    last_modified=os.path.getmtime(filepath),
                    session_duration_target=session_target,
                ))
        except PermissionError:
            pass

    def _print_distribution(self):
        tiers = {
            "Deep Focus (90-100)": [],
            "Steady Work (75-89)": [],
            "Reading (60-74)": [],
            "Quick Tweaks (40-59)": [],
            "Glancing (20-39)": [],
            "Brief Touch (0-19)": [],
        }

        for f in self.files:
            c = f.complexity
            if c >= 90: tiers["Deep Focus (90-100)"].append(f)
            elif c >= 75: tiers["Steady Work (75-89)"].append(f)
            elif c >= 60: tiers["Reading (60-74)"].append(f)
            elif c >= 40: tiers["Quick Tweaks (40-59)"].append(f)
            elif c >= 20: tiers["Glancing (20-39)"].append(f)
            else: tiers["Brief Touch (0-19)"].append(f)

        print(f"\n  {Colors.BOLD}Complexity Distribution:{Colors.RESET}")
        for tier_name, tier_files in tiers.items():
            bar = "█" * min(len(tier_files), 30)
            print(f"    {Colors.DIM}{tier_name:22s}{Colors.RESET} {len(tier_files):3d} {Colors.CYAN}{bar}{Colors.RESET}")


class HumanModel:
    def __init__(self):
        self.hour = datetime.now().hour
        self.day = datetime.now().weekday()

    def circadian_speed_multiplier(self) -> float:
        hour = datetime.now().hour
        if 10 <= hour < 18:
            return random.uniform(0.9, 1.1)
        elif 7 <= hour < 10 or 18 <= hour < 23:
            return random.uniform(0.6, 0.85)
        else:
            return random.uniform(0.2, 0.5)

    def power_law_edit_size(self) -> int:
        size = int(random.paretovariate(2.5))
        if random.random() < 0.15:
            return -min(size, 5)
        return min(size, 50)

    def session_idle_time(self, base_interval: int, chaos_factor: float = 1.0) -> float:
        roll = random.random()
        if roll < 0.5:
            return random.uniform(5, 20) * chaos_factor
        elif roll < 0.8:
            return random.uniform(30, 120) * chaos_factor
        elif roll < 0.95:
            jitter = random.uniform(-base_interval * 0.3, base_interval * 0.6)
            return max(15, base_interval + jitter) * chaos_factor
        else:
            return random.uniform(180, 480) * chaos_factor

    def file_familiarity_bias(self, familiarity: float) -> float:
        return 0.3 + (familiarity * 0.6)

    def weekend_penalty(self) -> float:
        if is_weekend():
            return 0.6
        return 1.0


class ScheduleManager:
    def __init__(self):
        self.daily_sent = 0
        self.daily_target = 0
        self.last_reset = datetime.now().date()
        self.insomnia_active = False
        self.insomnia_end = 0.0
        self._reset_daily_target()

    def _reset_daily_target(self):
        base = DAILY_TARGET_HOURS
        if is_weekend():
            base *= (1 - WEEKEND_CODING_REDUCTION)
        variation = random.uniform(-1.0, 1.5)
        self.daily_target = max(4.0, min(10.0, base + variation))
        self.daily_sent = 0
        self.last_reset = datetime.now().date()
        print(f"\n{Colors.CYAN}Daily target: {self.daily_target:.1f} hours{Colors.RESET}")

    def should_code(self) -> tuple[bool, str]:
        if datetime.now().date() != self.last_reset:
            self._reset_daily_target()

        hour = current_hour()

        if self.insomnia_active:
            if hour < self.insomnia_end:
                return True, "INSOMNIA_HYPERFOCUS"
            else:
                self.insomnia_active = False
                print(f"\n{Colors.YELLOW}Hyperfocus session ended. Going to sleep...{Colors.RESET}")
                return False, "SLEEP"

        hours_coded = self.daily_sent * (30 / 3600)
        if hours_coded >= self.daily_target:
            if random.random() < 0.15:
                return True, "ADHD_OVERTIME"
            return False, "DAILY_TARGET_MET"

        if LUNCH_START <= hour < LUNCH_END:
            return False, "LUNCH"

        if EVENING_START <= hour < EVENING_END:
            if random.random() < 0.1:
                return True, "ADHD_EVENING_BURST"
            return False, "EVENING"

        if INSOMNIA_START <= hour < INSOMNIA_END:
            if random.random() < INSOMNIA_CHANCE and not self.insomnia_active:
                self.insomnia_active = True
                self.insomnia_end = random.uniform(2.0, 4.5)
                duration = (self.insomnia_end - hour) * 60
                print(f"\n{Colors.CYAN}ADHD INSOMNIA MODE: Hyperfocus session starting!")
                print(f"Will code intensely for ~{duration:.0f} minutes{Colors.RESET}\n")
                return True, "INSOMNIA_START"
            return False, "SLEEP"

        if 4.0 <= hour < 7.0:
            if random.random() < 0.05:
                return True, "EARLY_BIRD"
            return False, "SLEEP"

        return True, "NORMAL"

    def get_chaos_factor(self) -> float:
        if is_weekend():
            return WEEKEND_CHAOS_FACTOR
        if self.insomnia_active:
            return 0.3
        return 1.0

    def get_intensity(self) -> str:
        if self.insomnia_active:
            return INSOMNIA_INTENSITY
        if is_weekend():
            return "relaxed"
        return "normal"

    def record_sent(self):
        self.daily_sent += 1


class WatchdogHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback
        self.recent_events: deque = deque(maxlen=100)

    def on_modified(self, event):
        if event.is_directory:
            return
        # Self-exclusion: ignore changes to the spoofer script itself
        event_name = Path(event.src_path).name.lower()
        script_indicators = {"hackatime", "wakatime", "spoofer", "heartbeat", "ghost"}
        if any(ind in event_name for ind in script_indicators):
            return
        ext = Path(event.src_path).suffix.lower()
        if ext in EXT_TO_LANGUAGE:
            now = time.time()
            for ts, path in self.recent_events:
                if path == event.src_path and now - ts < 2:
                    return
            self.recent_events.append((now, event.src_path))
            self.callback(event.src_path, "modified")

    def on_created(self, event):
        if event.is_directory:
            return
        # Self-exclusion: ignore creation of the spoofer script itself
        event_name = Path(event.src_path).name.lower()
        script_indicators = {"hackatime", "wakatime", "spoofer", "heartbeat", "ghost"}
        if any(ind in event_name for ind in script_indicators):
            return
        ext = Path(event.src_path).suffix.lower()
        if ext in EXT_TO_LANGUAGE:
            self.callback(event.src_path, "created")


class ConnectionMonitor:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        credentials = base64.b64encode(api_key.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "User-Agent": "wakatime/14.0.0 (test-client)",
        }
        self.is_connected = False
        self.consecutive_errors = 0

    def check(self) -> bool:
        for endpoint in ["", "/users/current"]:
            try:
                url = f"{self.api_url}{endpoint}"
                resp = requests.get(url, headers=self.headers, timeout=10)
                if resp.status_code in (200, 201, 202, 401):
                    self.is_connected = True
                    self.consecutive_errors = 0
                    return True
            except:
                continue
        self.is_connected = False
        self.consecutive_errors += 1
        return False

    def print_banner(self, fingerprint: SpoofedFingerprint):
        print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}  WAKATIME GHOST MODE v9.1 - DYNAMIC SCANNER{Colors.RESET}")
        print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")
        print(f"  API URL:      {Colors.CYAN}{API_URL}{Colors.RESET}")
        print(f"  API Key:      {Colors.DIM}{'*' * min(len(API_KEY), 20)}{Colors.RESET}")
        print(f"  Rate Limit:   {Colors.CYAN}{HEARTBEAT_RATE_LIMIT_SECONDS}s{Colors.RESET}")
        print(f"  Spoofed Host: {Colors.DIM}{fingerprint.hostname}{Colors.RESET}")
        print(f"  Machine ID:   {Colors.DIM}{fingerprint.machine_id[:16]}...{Colors.RESET}")
        print(f"  Timezone:     {Colors.DIM}{fingerprint.timezone}{Colors.RESET}")
        print(f"  UA:           {Colors.DIM}{fingerprint.user_agent}{Colors.RESET}\n")

        print(f"  {Colors.DIM}Testing connectivity...{Colors.RESET}", end=" ", flush=True)
        if self.check():
            print(f"{Colors.GREEN}CONNECTED ✓{Colors.RESET}\n")
        else:
            print(f"{Colors.RED}FAILED ✗{Colors.RESET}\n")
            print(f"  {Colors.YELLOW}Warning: Server unreachable. Will retry.{Colors.RESET}\n")

    def print_status(self, stats: dict, project: str, mode: str, schedule_reason: str = "", current_file: str = ""):
        now = datetime.now().strftime("%H:%M:%S")
        if self.is_connected:
            dot = status_dot(Colors.GREEN)
            conn = f"{Colors.GREEN}UP{Colors.RESET}"
        elif self.consecutive_errors > 3:
            dot = status_dot(Colors.RED)
            conn = f"{Colors.RED}DOWN{Colors.RESET}"
        else:
            dot = status_dot(Colors.YELLOW)
            conn = f"{Colors.YELLOW}WARN{Colors.RESET}"

        reason = f"| {Colors.DIM}{schedule_reason[:15]}{Colors.RESET}" if schedule_reason else ""
        file_short = current_file.split("/")[-1][:20] if current_file else "none"

        print(
            f"[{Colors.DIM}{now}{Colors.RESET}] "
            f"{dot} {conn} | "
            f"{Colors.CYAN}{stats['sent']}{Colors.RESET}s "
            f"{Colors.YELLOW}{stats['real']}{Colors.RESET}r "
            f"{Colors.YELLOW}{stats['queued']}{Colors.RESET}q "
            f"{Colors.RED}{stats['errors']}{Colors.RESET}e "
            f"{Colors.YELLOW}{stats['429_backoffs']}{Colors.RESET}429 | "
            f"{Colors.BOLD}{mode}{Colors.RESET} | "
            f"{file_short}"
            f"{reason}"
        )


class GhostEngine:
    def __init__(self, api_url: str, api_key: str, files: List[ScannedFile],
                 fingerprint: SpoofedFingerprint, scanner: SmartScanner):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.files = files
        self.fingerprint = fingerprint
        self.scanner = scanner
        self.human = HumanModel()
        self.monitor = ConnectionMonitor(api_url, api_key)
        self.schedule = ScheduleManager()

        credentials = base64.b64encode(api_key.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
            "User-Agent": fingerprint.user_agent,
            "X-Machine-Id": fingerprint.machine_id,
            "X-Mac-Hash": fingerprint.mac_hash,
            "X-Timezone": fingerprint.timezone,
            "X-Editor": fingerprint.editor,
            "X-Editor-Version": fingerprint.editor_version,
            "X-OS": fingerprint.os_name,
        }

        self.stats = {
            "sent": 0, "real": 0, "simulated": 0,
            "queued": 0, "retried": 0,
            "errors": 0, "429_backoffs": 0,
        }
        self.offline_queue: deque = deque(maxlen=1000)
        self.backoff_until: float = 0.0

        self.current_file: Optional[ScannedFile] = None
        self.current_project: str = ""
        self.mode = "SIMULATED"

        self.files_touched_today: Set[str] = set()
        self.daily_file_target = random.randint(DAILY_FILE_TARGET_MIN, DAILY_FILE_TARGET_MAX)
        self.session_start_time: float = 0.0

        self.watchdog_events: deque = deque(maxlen=50)
        self.observer: Optional[Observer] = None
        if WATCHDOG_AVAILABLE:
            self._setup_watchdog()

    def _setup_watchdog(self):
        handler = WatchdogHandler(self._on_real_event)
        self.observer = Observer()

        watched = set()
        for f in self.files:
            dir_path = str(Path(f.entity).parent)
            if dir_path not in watched:
                try:
                    self.observer.schedule(handler, dir_path, recursive=False)
                    watched.add(dir_path)
                except:
                    pass

        if watched:
            self.observer.start()
            print(f"  {Colors.GREEN}Watchdog active{Colors.RESET}: monitoring {len(watched)} directories")
        else:
            print(f"  {Colors.YELLOW}Watchdog: no directories to monitor{Colors.RESET}")

    def _on_real_event(self, filepath: str, event_type: str):
        # Self-exclusion: never process events for the spoofer script itself
        filepath_lower = filepath.lower()
        script_indicators = {"hackatime", "wakatime", "spoofer", "heartbeat", "ghost"}
        if any(ind in filepath_lower for ind in script_indicators):
            return

        for f in self.files:
            if f.entity == filepath.replace("\\", "/"):
                self.watchdog_events.append((time.time(), f, event_type))
                return

        path = Path(filepath)
        ext = path.suffix.lower()
        new_file = ScannedFile(
            entity=filepath.replace("\\", "/"),
            project=path.parent.name,
            branch="main",
            language=EXT_TO_LANGUAGE.get(ext, "Unknown"),
            lines=random.randint(10, 200),
            complexity=50.0,
            session_duration_target=10.0,
        )
        self.files.append(new_file)
        self.watchdog_events.append((time.time(), new_file, event_type))

    def _is_recently_visited(self, file: ScannedFile, now: float) -> bool:
        if file.last_sent == 0:
            return False
        minutes_since = (now - file.last_sent) / 60
        cooldown = TOP_TIER_RECENCY_COOLDOWN_MINUTES if file.complexity >= 90 else RECENCY_COOLDOWN_MINUTES
        return minutes_since < cooldown

    def _pick_file(self, is_write: bool) -> Optional[ScannedFile]:
        now = time.time()

        if self.current_file and self.current_file.is_in_session(now):
            if self.current_file.can_send(now, is_write, HEARTBEAT_RATE_LIMIT_SECONDS):
                self.mode = "SESSION"
                return self.current_file

        eligible = [f for f in self.files if f.can_send(now, is_write, HEARTBEAT_RATE_LIMIT_SECONDS)]
        if not eligible:
            return None

        if self.watchdog_events and random.random() < 0.3:
            ts, real_file, event_type = self.watchdog_events.popleft()
            if real_file in eligible and not self._is_recently_visited(real_file, now):
                self.mode = "REAL"
                self._start_new_session(real_file, now)
                return real_file

        self.mode = "SIMULATED"

        need_more_files = len(self.files_touched_today) < self.daily_file_target
        if not need_more_files:
            eligible = [f for f in eligible if not self._is_recently_visited(f, now)]
            if not eligible:
                eligible = [f for f in self.files if f.can_send(now, is_write, HEARTBEAT_RATE_LIMIT_SECONDS)]

        if self.current_project:
            project_files = [f for f in eligible if f.project == self.current_project]
            if project_files and random.random() < 0.7:
                if self.current_file:
                    current_dir = str(Path(self.current_file.entity).parent)
                    dir_files = [f for f in project_files if str(Path(f.entity).parent) == current_dir]
                    if dir_files and random.random() < 0.6:
                        eligible = dir_files
                    else:
                        eligible = project_files

        weights = []
        for f in eligible:
            w = f.complexity ** 1.5
            if f.entity not in self.files_touched_today:
                w *= 2.0
            if f.total_time_minutes > 60:
                w *= 0.5
            weights.append(max(w, 0.1))

        chosen = random.choices(eligible, weights=weights, k=1)[0]
        self._start_new_session(chosen, now)
        return chosen

    def _start_new_session(self, file: ScannedFile, now: float):
        self.current_file = file
        self.current_project = file.project
        self.session_start_time = now
        self.files_touched_today.add(file.entity)
        file.start_session(now, file.session_duration_target)

    def _build_heartbeat(self, file: ScannedFile, is_write: bool, timestamp: Optional[float] = None) -> dict:
        if is_write:
            delta = self.human.power_law_edit_size()
            file.lines = max(1, file.lines + delta)

        lineno = random.randint(1, max(1, file.lines))
        line_length = max(10, min(120, int(random.gauss(50, 20))))
        cursorpos = random.randint(0, line_length)

        languages = list(self.scanner.auto_lang_weights.keys())
        weights = list(self.scanner.auto_lang_weights.values())
        language = random.choices(languages, weights=weights, k=1)[0] if languages else file.language

        return {
            "entity": file.entity,
            "type": "file",
            "time": timestamp if timestamp is not None else time.time(),
            "category": "coding",
            "is_write": is_write,
            "project": file.project,
            "branch": file.branch,
            "language": language,
            "lines": file.lines,
            "lineno": lineno,
            "cursorpos": cursorpos,
            "user_agent": self.fingerprint.user_agent,
            "editor": self.fingerprint.editor,
            "version": self.fingerprint.editor_version,
        }

    def _send(self, url: str, payload, retries: int = 3) -> Optional[requests.Response]:
        if time.time() < self.backoff_until:
            time.sleep(max(0, self.backoff_until - time.time()))

        for attempt in range(retries):
            try:
                resp = requests.post(url, headers=self.headers, json=payload, timeout=15)
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 60))
                    self.backoff_until = time.time() + retry_after
                    self.stats["429_backoffs"] += 1
                    if attempt < retries - 1:
                        time.sleep(retry_after)
                        continue
                    return resp
                if resp.status_code in (201, 202):
                    try:
                        data = resp.json()
                        if "data" in data or "responses" in data or "id" in data:
                            return resp
                    except:
                        return resp
                if 500 <= resp.status_code < 600 and attempt < retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return resp
            except requests.RequestException:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    self.stats["errors"] += 1
                    return None
        return None

    def send_heartbeat(self, file: ScannedFile, is_write: bool) -> bool:
        hb = self._build_heartbeat(file, is_write)
        resp = self._send(f"{self.api_url}/users/current/heartbeats", hb)

        if resp and resp.status_code in (201, 202):
            file.mark_sent(time.time())
            self.stats["sent"] += 1
            self.schedule.record_sent()
            if self.mode == "REAL":
                self.stats["real"] += 1
            else:
                self.stats["simulated"] += 1
            return True
        else:
            if resp:
                self.stats["errors"] += 1
            self.offline_queue.append((file, is_write))
            self.stats["queued"] += 1
            return False

    def _drain_queue(self):
        if not self.offline_queue:
            return
        to_retry = []
        while self.offline_queue:
            to_retry.append(self.offline_queue.popleft())
        print(f"\n{Colors.YELLOW}Draining {len(to_retry)} queued...{Colors.RESET}")
        for file, is_write in to_retry:
            if self.send_heartbeat(file, is_write):
                self.stats["retried"] += 1
            time.sleep(0.5)

    def run_24_7(self):
        self.monitor.print_banner(self.fingerprint)

        print(f"{Colors.BOLD}Starting 24/7 Ghost Mode with Dynamic Scanner...{Colors.RESET}\n")
        print(f"{Colors.DIM}Schedule: ~{DAILY_TARGET_HOURS}h/day | Lunch {LUNCH_START}-{LUNCH_END}")
        print(f"Evening off {EVENING_START}-{EVENING_END} | Insomnia chance: {INSOMNIA_CHANCE*100:.0f}%")
        print(f"Daily file target: {self.daily_file_target} unique files")
        print(f"Press Ctrl+C to stop.{Colors.RESET}\n")

        last_status = time.time()
        last_day_reset = datetime.now().date()

        try:
            while True:
                now = time.time()
                today = datetime.now().date()

                if today != last_day_reset:
                    self.files_touched_today.clear()
                    self.daily_file_target = random.randint(DAILY_FILE_TARGET_MIN, DAILY_FILE_TARGET_MAX)
                    last_day_reset = today
                    print(f"\n{Colors.CYAN}New day! Target: {self.daily_file_target} unique files{Colors.RESET}")

                hour = current_hour()
                should_code, reason = self.schedule.should_code()

                if now - last_status >= 30:
                    self.monitor.check()
                    hours_today = self.schedule.daily_sent * (30 / 3600)
                    current_file_name = self.current_file.entity if self.current_file else "none"
                    status_reason = f"{reason} | {hours_today:.1f}h/{self.schedule.daily_target:.1f}h | {len(self.files_touched_today)}/{self.daily_file_target} files"
                    self.monitor.print_status(self.stats, self.current_project, self.mode, status_reason, current_file_name)
                    last_status = now

                if not should_code:
                    sleep_time = random.uniform(60, 180)
                    if reason == "SLEEP":
                        sleep_time = random.uniform(300, 900)
                    elif reason == "LUNCH":
                        sleep_time = random.uniform(300, 600)
                    time.sleep(sleep_time)
                    continue

                is_write = random.random() < 0.12

                file = self._pick_file(is_write)
                if file:
                    self.send_heartbeat(file, is_write)
                else:
                    time.sleep(2)
                    continue

                chaos = self.schedule.get_chaos_factor()
                base_interval = 30 * self.human.circadian_speed_multiplier() * self.human.weekend_penalty()
                idle = self.human.session_idle_time(base_interval, chaos)

                if self.schedule.insomnia_active:
                    idle = random.uniform(3, 15)

                time.sleep(idle)

        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Interrupted.{Colors.RESET}")

        if self.observer:
            self.observer.stop()
            self.observer.join()

        self._drain_queue()
        self.monitor.check()
        self.monitor.print_status(self.stats, self.current_project, "DONE")

        print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}  GHOST SESSION COMPLETE{Colors.RESET}")
        print(f"{Colors.BOLD}{'='*60}{Colors.RESET}")
        print(f"  Total sent:    {self.stats['sent']}")
        print(f"  Real events:   {self.stats['real']}")
        print(f"  Simulated:     {self.stats['simulated']}")
        print(f"  Queued:        {self.stats['queued']}")
        print(f"  Retried:       {self.stats['retried']}")
        print(f"  Errors:        {self.stats['errors']}")
        print(f"  429s:          {self.stats['429_backoffs']}")
        touched = [f for f in self.files if f.last_sent > 0]
        print(f"  Files touched: {len(touched)}/{len(self.files)}")

        top_files = sorted(self.files, key=lambda f: f.total_time_minutes, reverse=True)[:10]
        print(f"\n  Top files by time spent:")
        for i, f in enumerate(top_files, 1):
            print(f"    {i}. {f.entity.split('/')[-1]} {Colors.DIM}({f.total_time_minutes:.0f}m, score: {f.complexity:.1f}){Colors.RESET}")

        print(f"{Colors.BOLD}{'='*60}{Colors.RESET}\n")

    def run_manual(self, duration_minutes: int = 30):
        self.monitor.print_banner(self.fingerprint)

        end_time = time.time() + (duration_minutes * 60)
        last_status = time.time()

        print(f"{Colors.BOLD}Starting {duration_minutes}-minute manual session...{Colors.RESET}\n")

        try:
            while time.time() < end_time:
                now = time.time()

                if now - last_status >= 15:
                    self.monitor.check()
                    current_file_name = self.current_file.entity if self.current_file else "none"
                    self.monitor.print_status(self.stats, self.current_project, self.mode, current_file=current_file_name)
                    last_status = now

                is_write = random.random() < 0.12

                file = self._pick_file(is_write)
                if file:
                    self.send_heartbeat(file, is_write)
                else:
                    time.sleep(2)
                    continue

                base_interval = 30 * self.human.circadian_speed_multiplier() * self.human.weekend_penalty()
                idle = self.human.session_idle_time(base_interval)
                time.sleep(idle)

        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Interrupted.{Colors.RESET}")

        if self.observer:
            self.observer.stop()
            self.observer.join()

        self._drain_queue()


def detect_git_root() -> Optional[str]:
    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        if (parent / ".git").is_dir():
            return str(parent)
    return None


def parse_roots(args_roots: Optional[List[str]]) -> List[str]:
    if args_roots:
        roots = []
        for r in args_roots:
            for sub in r.split(","):
                sub = sub.strip()
                if sub:
                    roots.append(sub)
        return roots

    env_paths = os.environ.get("PROJECT_PATHS", "")
    if env_paths:
        return [p.strip() for p in env_paths.split(",") if p.strip()]

    git_root = detect_git_root()
    if git_root:
        return [git_root]

    return [str(Path.cwd())]


def main():
    global API_URL, API_KEY, SPOOF_EDITOR, SPOOF_EDITOR_VERSION, SPOOF_OS

    parser = argparse.ArgumentParser(description="WakaTime Ghost Mode v9.1 - Dynamic Scanner")
    parser.add_argument("--roots", nargs="+", help="Comma-separated root directories to scan")
    parser.add_argument("--api-url", default=API_URL, help="Hackatime API URL")
    parser.add_argument("--api-key", default=API_KEY, help="API key")
    parser.add_argument("--spoof-editor", default=SPOOF_EDITOR, help="Editor to spoof")
    parser.add_argument("--spoof-editor-version", default=SPOOF_EDITOR_VERSION, help="Editor version")
    parser.add_argument("--spoof-os", default=SPOOF_OS, help="OS to spoof")
    parser.add_argument("--mode", choices=["24-7", "manual"], default="24-7", help="Run mode")
    parser.add_argument("--duration", type=int, default=30, help="Manual mode duration (minutes)")
    parser.add_argument("--target-files", type=int, default=None, help="Override daily file target")
    args = parser.parse_args()
    API_URL = args.api_url
    API_KEY = args.api_key
    SPOOF_EDITOR = args.spoof_editor
    SPOOF_EDITOR_VERSION = args.spoof_editor_version
    SPOOF_OS = args.spoof_os

    roots = parse_roots(args.roots)

    fingerprint = SpoofedFingerprint(
        editor=SPOOF_EDITOR,
        editor_version=SPOOF_EDITOR_VERSION,
        os_name=SPOOF_OS,
    )
    scanner = SmartScanner(roots)
    files = scanner.scan()

    if not files:
        print(f"{Colors.RED}No files found!{Colors.RESET}")
        print(f"Check roots and that you have code files in: {roots}")
        sys.exit(1)

    engine = GhostEngine(API_URL, API_KEY, files, fingerprint, scanner)

    if args.target_files:
        engine.daily_file_target = args.target_files

    if args.mode == "24-7":
        engine.run_24_7()
    else:
        engine.run_manual(args.duration)


if __name__ == "__main__":
    main()
