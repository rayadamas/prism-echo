# Working on Prism Echo

Start with Node 22+ and `npm run dev`. There are no dependencies to install. Source lives in `src/` and `public/`; `dist/` is generated.

Before submitting a change, run `npm run verify` and check the relevant items in [docs/QA.md](docs/QA.md). For renderer changes, use behavioral fixtures that cover the visual property being changed rather than snapshotting every implementation detail. Keep the foreground's original pixels intact.

Keep image processing local, avoid runtime CDN dependencies, and preserve recipe compatibility. Do not include personal uploads or credentials in a patch. Describe the trigger, resulting behavior, and validation in a pull request.

No open-source license has been selected. Discuss reuse or contributions with the project owner before distributing modified versions.
