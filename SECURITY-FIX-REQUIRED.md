# URGENT: Security Fix Required

## Issue
Your Google AI API key was leaked in the git repository and has been reported as compromised.

**Leaked Key**: `AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY`

## Files Fixed
I've removed the hardcoded API key from:
- ✅ `services/workflow-agent/deploy.sh`
- ✅ `services/workflow-agent/README.md`

## Files That Still Have It (but are gitignored)
These files contain the key but are NOT tracked in git (they're in .gitignore):
- `app/.env`
- `app/.env.local`
- `web3/.env`
- `original-app/.env`
- `services/workflow-agent/.env`

## What You Need To Do NOW

### 1. Get a New API Key
1. Go to https://aistudio.google.com/app/apikey
2. Delete the old key `AIzaSyD9Wa0jy-3C4zb0kVsPS-sDD5DaN8GuJjY` (it's already blocked anyway)
3. Create a new API key
4. **DO NOT** commit it to git

### 2. Update Your Local Environment
```bash
# Update all .env files with the new key
export NEW_KEY="your_new_api_key_here"

# App
echo "GOOGLE_AI_API_KEY=$NEW_KEY" >> app/.env
echo "GEMINI_API_KEY=$NEW_KEY" >> app/.env

# Web3
echo "GOOGLE_AI_API_KEY=$NEW_KEY" >> web3/.env
echo "GEMINI_API_KEY=$NEW_KEY" >> web3/.env

# Workflow Agent
echo "GOOGLE_AI_API_KEY=$NEW_KEY" >> services/workflow-agent/.env
echo "GEMINI_API_KEY=$NEW_KEY" >> services/workflow-agent/.env
```

### 3. Deploy the Fixed Workflow Agent
```bash
cd services/workflow-agent

# Set the new API key
export GOOGLE_AI_API_KEY="your_new_api_key_here"

# Deploy (the deploy.sh now requires the env var)
./deploy.sh
```

### 4. Commit the Security Fixes
```bash
git add services/workflow-agent/deploy.sh
git add services/workflow-agent/README.md
git commit -m "security: remove hardcoded API keys from tracked files"
git push
```

## Why This Happened
The workflow agent wasn't working because:
1. The API key was leaked in git
2. Google detected the leak and blocked the key with a 403 error
3. The AI couldn't run, so no nodes were being created

## Prevention
- ✅ Never hardcode API keys in tracked files
- ✅ Always use environment variables
- ✅ The deploy.sh now checks for the env var before deploying
- ✅ The README now shows placeholder instead of real key

## Current Status
- ❌ Workflow agent is DOWN (blocked API key)
- ⏳ Waiting for you to get new key and redeploy
- ✅ Code is fixed to prevent future leaks
