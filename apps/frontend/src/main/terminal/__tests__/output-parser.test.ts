import { describe, expect, it } from 'vitest';
import {
  detectClaudeExit,
  isClaudeExitOutput,
  isClaudeBusyOutput,
  isClaudeIdleOutput,
  detectClaudeBusyState,
  extractClaudeSessionId,
  extractRateLimitReset,
  extractOAuthToken,
  extractEmail,
  hasRateLimitMessage,
  hasOAuthToken,
  detectProviderRateLimit,
  detectProviderBusyState,
  detectProviderExit,
  detectApiKeyError,
} from '../output-parser';

describe('output-parser', () => {
  describe('detectClaudeExit', () => {
    describe('should detect shell prompts (Claude has exited)', () => {
      const shellPrompts = [
        // user@hostname patterns
        { input: 'user@hostname:~$ ', desc: 'bash: user@hostname:~$' },
        { input: 'user@host:~/projects$ ', desc: 'bash with path' },
        { input: 'root@server:/var/log# ', desc: 'root prompt' },
        { input: 'dev@localhost:~ % ', desc: 'zsh style' },

        // Bracket prompts
        { input: '[user@host directory]$ ', desc: 'bracket prompt' },
        { input: '  [user@host ~]$ ', desc: 'bracket prompt with leading space' },

        // Virtual environment prompts
        { input: '(venv) user@host:~$ ', desc: 'venv prompt' },
        { input: '(base) $ ', desc: 'conda base prompt' },
        { input: '(myenv) ~/projects $ ', desc: 'venv with path' },

        // Starship/Oh-My-Zsh prompts
        { input: '❯ ', desc: 'starship arrow' },
        { input: '  ❯ ', desc: 'starship with space' },
        { input: '➜ ', desc: 'oh-my-zsh arrow' },
        { input: 'λ ', desc: 'lambda prompt' },

        // Fish shell prompts
        { input: '~/projects> ', desc: 'fish path prompt' },
        { input: '/home/user> ', desc: 'fish absolute path' },

        // Git branch prompts
        { input: '(main) $ ', desc: 'git branch prompt' },
        { input: '[feature/test] > ', desc: 'git branch in brackets' },

        // Simple hostname prompts
        { input: 'hostname$ ', desc: 'simple hostname$' },
        { input: 'myserver% ', desc: 'hostname with %' },

        // Explicit exit messages
        { input: 'Goodbye!', desc: 'goodbye message' },
        { input: 'Session ended', desc: 'session ended' },
        { input: 'Exiting Claude', desc: 'exiting claude' },
      ];

      it.each(shellPrompts)('detects: $desc', ({ input }) => {
        expect(detectClaudeExit(input)).toBe(true);
      });
    });

    describe('should NOT detect these as exit (Claude is still active or these are Claude output)', () => {
      const notExitPatterns = [
        // Claude's idle prompt
        { input: '> ', desc: 'Claude idle prompt (just >)' },
        { input: '\n> ', desc: 'Claude idle prompt after newline' },

        // Claude busy indicators
        { input: '● Working on your request...', desc: 'Claude bullet point' },
        { input: 'Loading...', desc: 'Claude loading' },
        { input: 'Read(/path/to/file.ts)', desc: 'Claude tool execution' },

        // Content that could false-positive match if not anchored
        { input: 'The path is ~/config $HOME', desc: 'path in explanation (should NOT match)' },
        { input: 'Use arr[index] to access elements', desc: 'array access in explanation' },
        { input: 'See the arrow → for details', desc: 'arrow in text' },
        { input: 'File path: ~/projects/test.js', desc: 'file path mid-line' },
        { input: 'Contact user@example.com for help', desc: 'email in text (mid-line)' },
        { input: 'user@example.com: please review this', desc: 'email at line start with colon (should NOT match)' },
        { input: 'admin@company.org: check the logs', desc: 'email at line start with text after colon' },
        { input: 'The variable $HOME is set to /Users/dev', desc: 'shell var in explanation' },
        { input: 'Example: (main) branch is default', desc: 'branch name in explanation' },

        // Progress indicators
        { input: '[Opus 4] 50%', desc: 'Opus progress' },
        { input: '███████░░░ 70%', desc: 'progress bar' },
      ];

      it.each(notExitPatterns)('ignores: $desc', ({ input }) => {
        expect(detectClaudeExit(input)).toBe(false);
      });
    });

    describe('should return false when Claude is busy even if shell-like patterns appear', () => {
      it('returns false when busy indicators present with shell pattern', () => {
        // This tests the guard in detectClaudeExit that checks busy state first
        const mixedOutput = '● Processing...\nuser@host:~$ ';
        expect(detectClaudeExit(mixedOutput)).toBe(false);
      });
    });
  });

  describe('isClaudeExitOutput', () => {
    it('detects user@hostname pattern at line start', () => {
      expect(isClaudeExitOutput('user@hostname:~$ ')).toBe(true);
      expect(isClaudeExitOutput('dev@server:/home$ ')).toBe(true);
    });

    it('does not match user@hostname in middle of line', () => {
      // With the line-start anchor, this should NOT match
      expect(isClaudeExitOutput('Contact user@hostname.com for help')).toBe(false);
    });

    it('detects goodbye message', () => {
      expect(isClaudeExitOutput('Goodbye!')).toBe(true);
      expect(isClaudeExitOutput('Goodbye')).toBe(true);
    });

    it('detects session ended', () => {
      expect(isClaudeExitOutput('Session ended')).toBe(true);
    });
  });

  describe('isClaudeBusyOutput', () => {
    const busyPatterns = [
      '● Here is my response',
      'Read(/path/to/file.ts)',
      'Write(/output.json)',
      'Loading...',
      'Thinking...',
      'Analyzing...',
      '[Opus 4] 25%',
      '[Sonnet 3.5] 50%',
      '██████░░░░',
    ];

    it.each(busyPatterns)('detects busy pattern: %s', (input) => {
      expect(isClaudeBusyOutput(input)).toBe(true);
    });

    it('returns false for normal text', () => {
      expect(isClaudeBusyOutput('Hello, how can I help?')).toBe(false);
    });
  });

  describe('isClaudeIdleOutput', () => {
    it('detects Claude idle prompt', () => {
      expect(isClaudeIdleOutput('> ')).toBe(true);
      expect(isClaudeIdleOutput('\n> ')).toBe(true);
      expect(isClaudeIdleOutput('  >  ')).toBe(true);
    });

    it('returns false for non-idle output', () => {
      expect(isClaudeIdleOutput('Hello')).toBe(false);
      expect(isClaudeIdleOutput('● Working')).toBe(false);
    });
  });

  describe('detectClaudeBusyState', () => {
    it('returns "busy" when busy indicators present', () => {
      expect(detectClaudeBusyState('● Thinking...')).toBe('busy');
      expect(detectClaudeBusyState('Loading...')).toBe('busy');
    });

    it('returns "idle" when idle prompt present and no busy indicators', () => {
      expect(detectClaudeBusyState('> ')).toBe('idle');
    });

    it('returns null when no state change detected', () => {
      expect(detectClaudeBusyState('Hello')).toBe(null);
    });

    it('prioritizes busy over idle', () => {
      // If both patterns present, busy should win
      expect(detectClaudeBusyState('● Working\n> ')).toBe('busy');
    });
  });

  describe('extractClaudeSessionId', () => {
    it('extracts session ID from "Session ID: xxx" format', () => {
      expect(extractClaudeSessionId('Session ID: abc123')).toBe('abc123');
      expect(extractClaudeSessionId('Session: xyz789')).toBe('xyz789');
    });

    it('extracts session ID from "Resuming session: xxx"', () => {
      expect(extractClaudeSessionId('Resuming session: sess_456')).toBe('sess_456');
    });

    it('returns null when no session ID found', () => {
      expect(extractClaudeSessionId('Hello world')).toBe(null);
    });
  });

  describe('extractRateLimitReset', () => {
    it('extracts rate limit reset time', () => {
      expect(extractRateLimitReset('Limit reached · resets Dec 17 at 6am (Europe/Oslo)')).toBe('Dec 17 at 6am (Europe/Oslo)');
      expect(extractRateLimitReset('Limit reached • resets Jan 1 at noon')).toBe('Jan 1 at noon');
    });

    it('returns null when no rate limit message', () => {
      expect(extractRateLimitReset('Normal output')).toBe(null);
    });
  });

  describe('hasRateLimitMessage', () => {
    it('returns true when rate limit message present', () => {
      expect(hasRateLimitMessage('Limit reached · resets tomorrow')).toBe(true);
    });

    it('returns false when no rate limit message', () => {
      expect(hasRateLimitMessage('Normal text')).toBe(false);
    });
  });

  describe('extractOAuthToken', () => {
    it('extracts OAuth token', () => {
      const token = 'sk-ant-oat01-abc123_XYZ';
      expect(extractOAuthToken(`Token: ${token}`)).toBe(token);
    });

    it('returns null when no token present', () => {
      expect(extractOAuthToken('No token here')).toBe(null);
    });
  });

  describe('hasOAuthToken', () => {
    it('returns true when OAuth token present', () => {
      expect(hasOAuthToken('sk-ant-oat01-test123')).toBe(true);
    });

    it('returns false when no token', () => {
      expect(hasOAuthToken('No token')).toBe(false);
    });
  });

  describe('extractEmail', () => {
    it('extracts email from "email:" format', () => {
      expect(extractEmail('email: user@example.com')).toBe('user@example.com');
      expect(extractEmail('email:dev@company.org')).toBe('dev@company.org');
    });

    it('extracts email with whitespace after "email"', () => {
      expect(extractEmail('email  test@domain.com')).toBe('test@domain.com');
    });

    it('returns null when no email found', () => {
      expect(extractEmail('No email here')).toBe(null);
    });

    it('extracts email from "Authenticated as" with space before email', () => {
      // The pattern includes space after "as" to match Claude CLI output
      expect(extractEmail('Authenticated as user@example.com')).toBe('user@example.com');
    });

    it('extracts email from "user@example.com\'s Organization" format', () => {
      expect(extractEmail("andre@mikalsenai.no's Organization")).toBe('andre@mikalsenai.no');
      expect(extractEmail("user@example.com's Organization")).toBe('user@example.com');
    });

    describe('ANSI escape code handling', () => {
      it('strips basic CSI color codes from email', () => {
        // Email with bold formatting: \x1b[1m starts bold, \x1b[0m resets
        const withBold = "\x1b[1mandre\x1b[0m@mikalsenai.no's Organization";
        expect(extractEmail(withBold)).toBe('andre@mikalsenai.no');
      });

      it('strips OSC 8 hyperlink sequences from email', () => {
        // Modern terminals wrap emails in OSC 8 hyperlinks
        // Format: \x1b]8;;url\x07visible_text\x1b]8;;\x07
        const withHyperlink = "\x1b]8;;mailto:andre@mikalsenai.no\x07andre@mikalsenai.no\x1b]8;;\x07's Organization";
        expect(extractEmail(withHyperlink)).toBe('andre@mikalsenai.no');
      });

      it('strips mixed ANSI codes (CSI + OSC)', () => {
        // Combination of color codes and hyperlinks
        const mixed = "\x1b[1m\x1b]8;;mailto:andre@mikalsenai.no\x07andre@mikalsenai.no\x1b]8;;\x07\x1b[0m's Organization";
        expect(extractEmail(mixed)).toBe('andre@mikalsenai.no');
      });

      it('strips OSC window title sequences', () => {
        // \x1b]0;title\x07 sets window title
        const withTitle = "\x1b]0;Claude Code\x07andre@mikalsenai.no's Organization";
        expect(extractEmail(withTitle)).toBe('andre@mikalsenai.no');
      });

      it('strips 256-color and true-color codes', () => {
        // 256-color: \x1b[38;5;123m
        // True-color: \x1b[38;2;255;128;0m
        const with256Color = "\x1b[38;5;123mandre\x1b[0m@mikalsenai.no's Organization";
        const withTrueColor = "\x1b[38;2;255;128;0mandre\x1b[0m@mikalsenai.no's Organization";
        expect(extractEmail(with256Color)).toBe('andre@mikalsenai.no');
        expect(extractEmail(withTrueColor)).toBe('andre@mikalsenai.no');
      });

      it('strips private mode CSI sequences', () => {
        // \x1b[?25h shows cursor, \x1b[?25l hides cursor
        const withPrivateMode = "\x1b[?25handre@mikalsenai.no\x1b[?25l's Organization";
        expect(extractEmail(withPrivateMode)).toBe('andre@mikalsenai.no');
      });

      it('handles email with formatting inside the address', () => {
        // Edge case: color code appears INSIDE the email address
        const colorInsideEmail = "andr\x1b[1me\x1b[0m@mikalsenai.no's Organization";
        expect(extractEmail(colorInsideEmail)).toBe('andre@mikalsenai.no');
      });
    });
  });
});

// =============================================================================
// Multi-Provider Tests
// =============================================================================

describe('Multi-Provider Support', () => {
  describe('detectProviderRateLimit', () => {
    describe('Claude rate limits', () => {
      it('detects Claude rate limit message', () => {
        const result = detectProviderRateLimit('Limit reached · resets Dec 17 at 6am');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('claude');
        expect(result?.resetTime).toBe('Dec 17 at 6am');
      });
    });

    describe('Gemini rate limits', () => {
      it('detects Gemini 429 error', () => {
        const result = detectProviderRateLimit('429 Too Many Requests', 'gemini');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('gemini');
      });

      it('detects Gemini quota exceeded', () => {
        const result = detectProviderRateLimit('quota has been exceeded', 'gemini');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('gemini');
      });

      it('detects RESOURCE_EXHAUSTED error', () => {
        const result = detectProviderRateLimit('RESOURCE_EXHAUSTED: quota exceeded', 'gemini');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('gemini');
      });
    });

    describe('OpenAI rate limits', () => {
      it('detects OpenAI rate limit message', () => {
        const result = detectProviderRateLimit('Rate limit reached for gpt-4o', 'openai');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('openai');
      });

      it('detects tokens per minute limit', () => {
        const result = detectProviderRateLimit('tokens per minute limit exceeded', 'openai');
        expect(result).not.toBeNull();
        expect(result?.provider).toBe('openai');
      });
    });

    it('returns null when no rate limit detected', () => {
      expect(detectProviderRateLimit('Normal output')).toBeNull();
      expect(detectProviderRateLimit('Hello world', 'gemini')).toBeNull();
      expect(detectProviderRateLimit('Processing...', 'openai')).toBeNull();
    });
  });

  describe('detectProviderBusyState', () => {
    describe('Claude busy states', () => {
      it('detects Claude busy state', () => {
        expect(detectProviderBusyState('● Working...', 'claude')).toBe('busy');
        expect(detectProviderBusyState('Loading...', 'claude')).toBe('busy');
      });

      it('detects Claude idle state', () => {
        expect(detectProviderBusyState('> ', 'claude')).toBe('idle');
      });
    });

    describe('Gemini busy states', () => {
      it('detects Gemini busy state', () => {
        expect(detectProviderBusyState('Generating...', 'gemini')).toBe('busy');
        expect(detectProviderBusyState('● Response', 'gemini')).toBe('busy');
      });

      it('detects Gemini idle state', () => {
        expect(detectProviderBusyState('> ', 'gemini')).toBe('idle');
      });
    });

    describe('OpenAI busy states', () => {
      it('detects OpenAI busy state', () => {
        expect(detectProviderBusyState('Generating...', 'openai')).toBe('busy');
        expect(detectProviderBusyState('Running...', 'openai')).toBe('busy');
      });

      it('detects OpenAI idle state', () => {
        expect(detectProviderBusyState('codex> ', 'openai')).toBe('idle');
      });
    });

    it('returns null for unknown state', () => {
      expect(detectProviderBusyState('Hello', 'claude')).toBeNull();
      expect(detectProviderBusyState('Some text', 'gemini')).toBeNull();
    });
  });

  describe('detectProviderExit', () => {
    it('detects exit for all providers', () => {
      expect(detectProviderExit('Goodbye!', 'claude')).toBe(true);
      expect(detectProviderExit('user@host:~$ ', 'gemini')).toBe(true);
      expect(detectProviderExit('Session ended', 'openai')).toBe(true);
    });

    it('returns false when provider is busy', () => {
      expect(detectProviderExit('● Working...\nuser@host:~$ ', 'claude')).toBe(false);
    });
  });

  describe('detectApiKeyError', () => {
    describe('Gemini API key errors', () => {
      it('detects invalid API key', () => {
        expect(detectApiKeyError('API key not valid', 'gemini')).toBe(true);
        expect(detectApiKeyError('Invalid API key provided', 'gemini')).toBe(true);
        expect(detectApiKeyError('INVALID_ARGUMENT: API key is invalid', 'gemini')).toBe(true);
      });
    });

    describe('OpenAI API key errors', () => {
      it('detects invalid API key', () => {
        expect(detectApiKeyError('Invalid API key provided', 'openai')).toBe(true);
        expect(detectApiKeyError('Incorrect API key', 'openai')).toBe(true);
        expect(detectApiKeyError('API key is invalid', 'openai')).toBe(true);
      });
    });

    it('returns false for valid output', () => {
      expect(detectApiKeyError('Hello world', 'gemini')).toBe(false);
      expect(detectApiKeyError('Processing request', 'openai')).toBe(false);
    });
  });
});
