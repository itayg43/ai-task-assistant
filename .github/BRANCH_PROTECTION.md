# Branch Protection Configuration

To ensure all tests pass before merging PRs to main, configure the following branch protection rules in your GitHub repository:

## Required Status Checks

1. Go to your repository on GitHub
2. Navigate to Settings → Branches
3. Add a rule for the `main` branch
4. Enable "Require status checks to pass before merging"
5. Select the following required status checks:
   - `test (18.x)` - Run Tests
   - `test (20.x)` - Run Tests
   - `lint-and-typecheck` - Lint and Type Check
   - `security-audit` - Security Audit
   - `pr-validation` - Validate Pull Request

## Additional Recommended Settings

- ✅ Require branches to be up to date before merging
- ✅ Require pull request reviews before merging (recommended: 1 reviewer)
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require review from code owners (if you have a CODEOWNERS file)
- ✅ Restrict pushes that create files larger than 100MB
- ✅ Require linear history (optional, for cleaner git history)

## Workflow Descriptions

### CI Pipeline (`ci.yml`)

- Runs on push to main/develop and on pull requests
- Tests on Node.js 18.x and 20.x
- Runs all tests except LLM tests
- Performs type checking and security audits
- Builds all services

### PR Checks (`pr-checks.yml`)

- Runs on every pull request
- Validates that all tests pass
- Ensures code quality and security standards

## Environment Variables

To add secrets:

1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the required environment variables
