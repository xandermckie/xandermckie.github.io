import data from '../data/rust/exercises.json';
import guide from '../data/rust/rust-guide.json';
import interviewPreview from '../data/rust/interview-preview.json';
import {
  CARGO_BOOK_URL,
  CRATES_IO_URL,
  EXERCISM_RUST_URL,
  GITHUB_CODESPACES_URL,
  GITHUB_HELLO_WORLD_URL,
  GITHUB_SIGNUP_URL,
  REPLIT_URL,
  RUST_ANALYZER_URL,
  RUST_BOOK_URL,
  RUST_BY_EXAMPLE_URL,
  RUST_DISCORD_URL,
  RUST_DOCS_URL,
  RUST_LEARN_URL,
  RUST_STD_URL,
  RUST_USERS_FORUM_URL,
  RUSTLINGS_URL,
  RUSTUP_URL,
  STACK_OVERFLOW_RUST_URL,
  THIS_WEEK_IN_RUST_URL,
  VSCODE_URL,
} from '../lib/links';
import { validateExercises } from '../lib/validation';
import { RUST_META } from './meta';
import type { GuideSection, InterviewPreview, LanguageKit, ResourceGroup } from './types';

const RESOURCES: ResourceGroup[] = [
  {
    heading: 'Official documentation',
    items: [
      { label: 'Learn Rust', url: RUST_LEARN_URL, description: 'The official starting map: book, examples, and std docs.', tag: 'Hub' },
      { label: 'The Rust Book', url: RUST_BOOK_URL, description: 'The guided tour from the core team. Best first long read.', tag: 'Book · Free' },
      { label: 'Rust by Example', url: RUST_BY_EXAMPLE_URL, description: 'Short runnable examples for each language feature.', tag: 'Tutorial' },
      { label: 'Standard Library', url: RUST_STD_URL, description: 'API docs for Vec, String, Result, iterators, and more.', tag: 'Reference' },
      { label: 'rustc / docs hub', url: RUST_DOCS_URL, description: 'Language reference, rustc book, and edition guide.', tag: 'Reference' },
      { label: 'The Cargo Book', url: CARGO_BOOK_URL, description: 'Build, test, and publish crates with Cargo.', tag: 'Tooling' },
    ],
  },
  {
    heading: 'Practice',
    items: [
      { label: 'rustlings', url: RUSTLINGS_URL, description: 'Small local exercises that teach the compiler one habit at a time.', tag: 'Practice' },
      { label: 'Exercism: Rust track', url: EXERCISM_RUST_URL, description: 'Mentored exercises you can run on your machine.', tag: 'Practice' },
      { label: 'crates.io', url: CRATES_IO_URL, description: 'The public crate registry. Read README files before you depend.', tag: 'Ecosystem' },
    ],
  },
  {
    heading: 'Tools & environments',
    items: [
      { label: 'rustup', url: RUSTUP_URL, description: 'Install rustc, cargo, rustfmt, and clippy.', tag: 'Toolchain' },
      { label: 'rust-analyzer', url: RUST_ANALYZER_URL, description: 'IDE engine used by VS Code and other editors.', tag: 'Editor' },
      { label: 'VS Code', url: VSCODE_URL, description: 'Free editor. Pair it with the rust-analyzer extension.', tag: 'Editor · Free' },
      { label: 'Replit', url: REPLIT_URL, description: 'Browser IDE if you cannot install locally yet.', tag: 'Online · Free' },
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
    heading: 'Community',
    items: [
      { label: 'Rust Users Forum', url: RUST_USERS_FORUM_URL, description: 'The official forum for questions and discussion.', tag: 'Community' },
      { label: 'Rust Discord', url: RUST_DISCORD_URL, description: 'Chat for help and project talk.', tag: 'Community' },
      { label: 'Stack Overflow: rust tag', url: STACK_OVERFLOW_RUST_URL, description: 'Search before you post. Many compiler errors are already explained.', tag: 'Community' },
      { label: 'This Week in Rust', url: THIS_WEEK_IN_RUST_URL, description: 'A weekly newsletter of crates, posts, and news.', tag: 'News' },
    ],
  },
];

export const rustKit: LanguageKit = {
  ...RUST_META,
  exercises: validateExercises(data),
  guide: guide as GuideSection[],
  interviewPreview: interviewPreview as InterviewPreview[],
  resources: RESOURCES,
};
