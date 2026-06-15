# Tested Passwords

Single-page GitHub Pages app for maintaining a shared denylist of wallet password candidates that were already tested and did not work.

## Important Security Note

A plaintext list of tested password candidates can reveal strategy, personal data, and search space assumptions. If the repository is public, assume everyone can read the list.

Public submissions are sent through GitHub Issues and processed by GitHub Actions. Participants do not need a token.

## Files

- `index.html`: static app.
- `styles.css`: app styling.
- `app.js`: GitHub API integration, dedupe, download.
- `tested-passwords.txt`: shared plaintext denylist, one candidate per line.

## GitHub Pages

1. Create a private repository.
2. Push these files to the repository.
3. In GitHub, open Settings -> Pages.
4. Set Source to Deploy from a branch.
5. Select `main` and `/root`.

## Usage

1. Click `Load Remote List`.
2. Paste tested failed passwords, one per line.
3. Click `Submit Publicly`.
4. Submit the pre-filled GitHub issue.
5. GitHub Actions deduplicates the lines, updates `tested-passwords.txt`, comments with a summary, and closes the issue.

You can also:

- click `Add To Local List` to deduplicate locally before submitting;
- use `Download TXT` for Hashcat `--exclude-passwordlist` or manual review.

## Public Competition Mode

This requires a GitHub account, but not a fine-grained token.

## Hashcat Exclude Example

```bash
hashcat -m 11300 -a 0 hash.txt new-candidates.txt --exclude-passwordlist tested-passwords.txt
```

If your Hashcat build does not support `--exclude-passwordlist`, filter before running:

```bash
comm -23 <(sort -u new-candidates.txt) <(sort -u tested-passwords.txt) > candidates-not-yet-tested.txt
```
