import data from '../data/exercises.json';
import guide from '../data/python-guide.json';
import interviewPreview from '../data/interview-preview.json';
import {
  AUTOMATE_BORING_STUFF_URL,
  COREY_SCHAFER_URL,
  CS50P_URL,
  EXERCISM_PYTHON_URL,
  GITHUB_CODESPACES_URL,
  GITHUB_HELLO_WORLD_URL,
  GITHUB_SIGNUP_URL,
  LEETCODE_URL,
  MOSH_PYTHON_URL,
  PYCHARM_URL,
  PYTHON_DISCORD_URL,
  PYTHON_DOCS_URL,
  PYTHON_STANDARD_LIBRARY_URL,
  PYTHON_TUTORIAL_URL,
  REAL_PYTHON_URL,
  REPLIT_URL,
  STACK_OVERFLOW_PYTHON_URL,
  TECH_WITH_TIM_URL,
  THONNY_URL,
  VSCODE_URL,
} from '../lib/links';
import { validateExercises } from '../lib/validation';
import { PYTHON_META } from './meta';
import type { GuideSection, InterviewPreview, LanguageKit, ResourceGroup } from './types';

const RESOURCES: ResourceGroup[] = [
  {
    heading: 'Official documentation',
    items: [
      { label: 'Python 3 Docs', url: PYTHON_DOCS_URL, description: 'Reference for built-ins, keywords, and modules.', tag: 'Reference' },
      { label: 'Official Tutorial', url: PYTHON_TUTORIAL_URL, description: 'Guided tour from the core team. Good first read.', tag: 'Tutorial' },
      { label: 'Standard Library', url: PYTHON_STANDARD_LIBRARY_URL, description: 'Every module that ships with Python, with API docs.', tag: 'Reference' },
    ],
  },
  {
    heading: 'Books & courses',
    items: [
      { label: 'Automate the Boring Stuff', url: AUTOMATE_BORING_STUFF_URL, description: 'Free online book by Al Sweigart about practical automation.', tag: 'Book · Free' },
      { label: 'CS50P (Harvard)', url: CS50P_URL, description: "Harvard's free Python course with lectures and problem sets.", tag: 'Course · Free' },
      { label: 'Real Python', url: REAL_PYTHON_URL, description: 'Tutorials from beginner to advanced.', tag: 'Tutorials' },
    ],
  },
  {
    heading: 'YouTube playlists',
    items: [
      { label: 'Mosh Hamedani: Python for Beginners', url: MOSH_PYTHON_URL, description: 'About six hours covering the basics.', tag: 'YouTube' },
      { label: 'Corey Schafer: Python Tutorials', url: COREY_SCHAFER_URL, description: 'Video series on Python, OOP, decorators, generators, and more.', tag: 'YouTube' },
      { label: 'Tech With Tim: Python Beginner', url: TECH_WITH_TIM_URL, description: 'Short beginner videos.', tag: 'YouTube' },
    ],
  },
  {
    heading: 'IDEs & environments',
    items: [
      { label: 'VS Code', url: VSCODE_URL, description: 'Free editor with Python support via the Microsoft extension.', tag: 'Editor · Free' },
      { label: 'PyCharm Community', url: PYCHARM_URL, description: 'Free Python IDE from JetBrains with debugger and refactoring.', tag: 'IDE · Free' },
      { label: 'Thonny', url: THONNY_URL, description: 'Small IDE for beginners. Shows variable values and steps through code.', tag: 'IDE · Free' },
      { label: 'Replit', url: REPLIT_URL, description: 'Browser IDE for trying code without installing anything locally.', tag: 'Online · Free' },
      { label: 'GitHub Codespaces', url: GITHUB_CODESPACES_URL, description: 'VS Code in the cloud, set up per repo.', tag: 'Online' },
    ],
  },
  {
    heading: 'GitHub & version control',
    items: [
      { label: 'Create a GitHub account', url: GITHUB_SIGNUP_URL, description: 'Free account with public and private repos.', tag: 'Free' },
      { label: 'GitHub: Hello World', url: GITHUB_HELLO_WORLD_URL, description: "GitHub's short guide to repos, branches, and pull requests.", tag: 'Guide' },
    ],
  },
  {
    heading: 'Practice & community',
    items: [
      { label: 'Exercism: Python track', url: EXERCISM_PYTHON_URL, description: 'Coding exercises with optional mentorship.', tag: 'Practice' },
      { label: 'LeetCode: Easy problems', url: LEETCODE_URL, description: 'Algorithm problems. Start with Easy.', tag: 'Practice' },
      { label: 'Python Discord', url: PYTHON_DISCORD_URL, description: 'Chat for questions and project help.', tag: 'Community' },
      { label: 'Stack Overflow: python tag', url: STACK_OVERFLOW_PYTHON_URL, description: 'Search before you post. Most beginner questions are already answered.', tag: 'Community' },
    ],
  },
];

export const pythonKit: LanguageKit = {
  ...PYTHON_META,
  exercises: validateExercises(data),
  guide: guide as GuideSection[],
  interviewPreview: interviewPreview as InterviewPreview[],
  resources: RESOURCES,
};
