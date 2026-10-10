# Publish Prism Echo

## Start from the release ZIP

Extract `prism-echo-v1.0.0.zip`, open a terminal in its `prism-echo/` folder, and run:

```sh
npm run verify
npm run dev
```

The app opens at `http://localhost:4173`. Stop the server with Ctrl+C before moving on.

## Create your GitHub repository

Create an empty repository named **prism-echo** on GitHub. Choose the visibility you want, and leave GitHub's README, license, and `.gitignore` options unchecked: those files are already included. For a public showcase, a public repository is the simplest setup.

From the extracted project directory:

```sh
git init
git add .
git commit -m "Launch Prism Echo portrait studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prism-echo.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. GitHub will use your configured Git credentials or prompt you to sign in. No token belongs in this project's source files.

The release contains no existing Git history, remote configuration, or hosted Site identity. Start from this ZIP to create an independent repository. `dist/` and `releases/` are ignored because they are generated.

## Turn on the live demo

1. In your new repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open **Actions → Deploy demo to GitHub Pages → Run workflow**. The first push can fail the Pages setup step if Pages hasn't been enabled yet; rerun it after enabling Pages.
4. Wait for the build and deployment jobs to pass. The deployment's environment link is the live demo URL.
5. Add that URL to the repository's **About → Website** field and to the top of `README.md`.

After setup, every push to `main` verifies and redeploys the app. The static files use relative paths, so project sites such as `https://YOUR_USERNAME.github.io/prism-echo/` work without changing a base URL.

The workflows follow GitHub's [automatic deployment tutorial](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically) and [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). GitHub Pages availability for private repositories depends on your plan; public repositories support the public demo workflow on GitHub Free.

## Customize the demo

The package contains an original generic avatar and showcase images made with the engine. To change the starting image:

1. Put your replacement in `public/assets/`.
2. Edit `public/demo.json`:

```json
{
  "name": "Your sample image",
  "image": "./assets/your-image.png"
}
```

3. Remove `public/assets/avatar.png` and its editable `avatar.svg` source if you no longer want them included.
4. Replace the showcase image in `docs/assets/avatar-showcase.png` and update its README caption if needed.
5. Run `npm run verify` and push the change.

Use a bundled same-origin asset, not a remote image URL. The **Use demo** button reloads this configuration while preserving your current effect controls.

## License

The source is currently rights reserved. If you decide to open-source the code, replace `LICENSE` with your chosen license, update `package.json`'s `license` field and the README license paragraph. Keep a separate portrait/asset notice if you want your image excluded from the code license.

## Ship a release

```sh
npm run verify
npm run release
git tag v1.0.0
git push origin v1.0.0
```

Create a GitHub Release for that tag and attach the ZIP and `.sha256` files from `releases/`. The ZIP includes both editable source and built `dist/`. Update the package version and changelog before shipping later releases.

## Other static hosts

Run `npm run build` and deploy the contents of `dist/` to any static host that serves `.mjs` files as JavaScript. No server runtime, environment variables, database, or secrets are required.
