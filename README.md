# AI Code Reviewer (Pro)

Paste code, get bugs, warnings and fixes from an LLM (Anthropic API).
Installable as an app, with a dark/light theme, review history and a phone layout.

## Run it
1. Install Node.js 18 or newer from https://nodejs.org
2. Open a terminal in this folder and run: `npm install`
3. Create a file named `.env` (copy `env.example.txt` and rename it to `.env`)
   and put your real key in it: `ANTHROPIC_API_KEY=sk-ant-...`
4. Run: `npm start`
5. Open http://localhost:3000

## Folder
```
ai-code-reviewer-pro/
├── server.js        Express server, keeps your API key private
├── package.json
├── env.example.txt  copy to .env and add your key
└── public/
    ├── index.html   interface
    ├── style.css    design
    ├── script.js    app logic
    ├── manifest.json, sw.js, icon*.png/svg   installable app files
```

## Troubleshooting
- "API key missing": the `.env` file is not in the project root, or you did not restart after editing it.
- "The LLM API returned an error": check your key and account credit. You can change the model with `MODEL=` in `.env`.
- Install button not showing: use Chrome or Edge on http://localhost:3000.
