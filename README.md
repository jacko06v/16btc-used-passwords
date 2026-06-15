# Tested Passwords

Single-page GitHub Pages app for maintaining a shared denylist of wallet password candidates that were already tested and did not work.

## Important Security Note

A plaintext list of tested password candidates can reveal strategy, personal data, and search space assumptions. If the repository is public, assume everyone can read the list.

The app stores the GitHub token only in the browser's `localStorage`. Every collaborator who needs to save should use their own fine-grained token with access limited to this single repository.

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

## Token Setup

Reading from a public repository works without a token. Saving changes requires a token.

Create a fine-grained GitHub token:

1. GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens.
2. Repository access: only this repository.
3. Permissions: Contents -> Read and write.
4. Paste the token into the app.

## Usage

1. Enter owner, repo, branch, file path, and token.
2. Click `Save Config`.
3. Click `Load Remote List`.
4. Paste tested failed passwords, one per line.
5. Click `Add To Local List`.
6. Click `Save To GitHub`.
7. Use `Download TXT` for Hashcat `--exclude-passwordlist` or manual review.

## Hashcat Exclude Example

```bash
hashcat -m 11300 -a 0 hash.txt new-candidates.txt --exclude-passwordlist tested-passwords.txt
```

If your Hashcat build does not support `--exclude-passwordlist`, filter before running:

```bash
comm -23 <(sort -u new-candidates.txt) <(sort -u tested-passwords.txt) > candidates-not-yet-tested.txt
```
