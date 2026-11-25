import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig(
  { files: ['src/**/*.ts'], languageOptions: {
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  } },
  ...obsidianmd.configs.recommended,
);
