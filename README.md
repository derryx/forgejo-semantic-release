# forgejo-semantic-release

[![npm version](https://img.shields.io/npm/v/forgejo-semantic-release.svg)](https://www.npmjs.com/package/forgejo-semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [semantic-release](https://github.com/semantic-release/semantic-release) plugin for [Forgejo](https://forgejo.org/) (and [Gitea](https://gitea.io/)).

This plugin enables automated releases on Forgejo/Gitea instances, including:
- Creating releases with release notes
- Uploading release assets (binaries, archives, etc.)
- Commenting on resolved issues and pull requests
- Creating failure issues when releases fail

## Installation

```bash
npm install forgejo-semantic-release --save-dev
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FORGEJO_TOKEN` or `GITEA_TOKEN` | **Required.** Personal access token with `write:repository` scope |
| `FORGEJO_URL` or `GITEA_URL` | Forgejo/Gitea server URL. Optional if detectable from git remote |

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `forgejoUrl` | `string` | From env or git remote | Forgejo server URL |
| `forgejoToken` | `string` | From env | API authentication token |
| `assets` | `string \| string[] \| AssetConfig[]` | `[]` | Glob patterns for release assets |
| `successComment` | `string \| false` | See below | Template for success comments |
| `successCommentCondition` | `string \| false` | `false` | Condition for posting success comments |
| `failComment` | `string` | See below | Template for failure issue body |
| `failTitle` | `string` | `"The automated release failed :rotating_light:"` | Title for failure issues |
| `labels` | `string[]` | `["semantic-release"]` | Labels for failure issues |
| `assignees` | `string[]` | `[]` | Assignees for failure issues |
| `releasedLabels` | `string[] \| false` | `false` | Labels to add to released issues/PRs |

### Asset Configuration

Assets can be specified as:
- A glob pattern string: `"dist/*.zip"`
- An array of glob patterns: `["dist/*.zip", "dist/*.tar.gz"]`
- An array of asset objects:

```json
{
  "assets": [
    { "path": "dist/app.zip", "name": "app-${nextRelease.version}.zip" },
    { "path": "dist/*.tar.gz", "label": "Source code" }
  ]
}
```

Asset object properties:
- `path` (required): Glob pattern or file path
- `name`: Override the filename for upload
- `type`: MIME type (auto-detected if omitted)
- `label`: Display label for the asset

## Usage

### Basic Configuration

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "forgejo-semantic-release"
  ]
}
```

### With Assets

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["forgejo-semantic-release", {
      "assets": [
        "dist/*.zip",
        "dist/*.tar.gz"
      ]
    }]
  ]
}
```

### Full Configuration Example

```json
{
  "branches": ["main", { "name": "beta", "prerelease": true }],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["forgejo-semantic-release", {
      "assets": [
        { "path": "dist/*.zip" },
        { "path": "dist/*.tar.gz" }
      ],
      "successComment": ":tada: This ${issue.pull_request ? 'PR is included' : 'issue has been resolved'} in version ${nextRelease.version}!\n\nSee the [release](${releases[0].url}) for details.",
      "failTitle": "Release pipeline failed",
      "labels": ["semantic-release", "automation"],
      "releasedLabels": ["released"]
    }]
  ]
}
```

## Lifecycle Hooks

This plugin implements four semantic-release lifecycle hooks:

### verifyConditions

Validates the plugin configuration and verifies access to the Forgejo API:
- Checks for required authentication token
- Tests API connectivity
- Verifies repository access and push permissions

### publish

Creates a new release on Forgejo:
- Creates a release for the git tag
- Uploads configured release assets
- Returns the release URL

### success

Runs after a successful release:
- Extracts issue/PR references from commit messages (e.g., `fixes #123`, `closes #456`)
- Posts success comments on resolved issues and PRs
- Optionally adds labels to released issues/PRs
- Closes any existing failure issues from previous failed releases

### fail

Runs when the release process fails:
- Creates a new issue documenting the failure, or
- Adds a comment to an existing failure issue
- Includes error details and branch information

## Templates

Success comments and failure issues support [Lodash template](https://lodash.com/docs/#template) syntax with access to the following variables:

| Variable | Description |
|----------|-------------|
| `branch` | Branch configuration (`name`, `prerelease`, `channel`) |
| `lastRelease` | Previous release info (`version`, `gitTag`, `gitHead`) |
| `nextRelease` | New release info (`version`, `gitTag`, `gitHead`, `notes`, `type`) |
| `commits` | Array of commits in this release |
| `releases` | Array of published releases |
| `issue` | Current issue object (success comments only) |
| `errors` | Array of errors (fail comments only) |

### Default Success Comment

```
:tada: This ${issue.pull_request ? 'PR is included' : 'issue has been resolved'} in version ${nextRelease.version} :tada:

The release is available on [Forgejo](${releases[0]?.url || 'the releases page'}).

Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
```

### Default Failure Comment

```
## :rotating_light: Automated release failed

The automated release from branch `${branch.name}` failed.

### Errors

${errors.map(err => '- ' + err.message).join('\n')}

---
*This issue was automatically created by semantic-release. Please fix the issues and push again.*
```

## Creating a Personal Access Token

1. Go to your Forgejo/Gitea instance
2. Navigate to **Settings** > **Applications**
3. Under **Generate New Token**, enter a token name
4. Select the following scopes:
   - `write:repository` (for creating releases and uploading assets)
   - `write:issue` (for commenting on issues and creating failure issues)
5. Click **Generate Token**
6. Copy the token and set it as `FORGEJO_TOKEN` environment variable

## CI/CD Examples

### Forgejo Actions

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Release
        env:
          FORGEJO_TOKEN: ${{ secrets.FORGEJO_TOKEN }}
        run: npx semantic-release
```

### GitLab CI (for Gitea)

```yaml
release:
  stage: deploy
  image: node:20
  script:
    - npm ci
    - npm run build
    - npx semantic-release
  variables:
    GITEA_URL: https://gitea.example.com
    GITEA_TOKEN: $GITEA_TOKEN
  only:
    - main
```

## Compatibility

- **Forgejo**: 1.x, 7.x, 8.x+ (API v1)
- **Gitea**: 1.17+ (API v1)
- **Node.js**: 18.0.0+
- **semantic-release**: 20.0.0+

## Differences from GitHub/GitLab Plugins

| Feature | forgejo-semantic-release | @semantic-release/github | @semantic-release/gitlab |
|---------|-------------------------|-------------------------|-------------------------|
| Create releases | Yes | Yes | Yes |
| Upload assets | Yes | Yes | Yes |
| Success comments | Yes | Yes | Yes |
| Failure issues | Yes | Yes | Yes |
| Draft releases | No | Yes | No |
| Discussions | No | Yes | No |
| Milestones | No | No | Yes |
| addChannel hook | No | Yes | No |

## Troubleshooting

### "No Forgejo token specified"

Ensure you have set either `FORGEJO_TOKEN` or `GITEA_TOKEN` environment variable with a valid personal access token.

### "Unable to determine Forgejo server URL"

Either:
- Set `FORGEJO_URL` or `GITEA_URL` environment variable
- Ensure your git remote origin is properly configured (e.g., `git remote set-url origin https://forgejo.example.com/owner/repo.git`)

### "Insufficient repository permissions"

The token must have write access to the repository. Verify:
- The token has `write:repository` scope
- The user associated with the token has push access to the repository

### Debug Mode

Enable debug output by setting the `DEBUG` environment variable:

```bash
DEBUG=forgejo-semantic-release:* npx semantic-release
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Related Projects

- [semantic-release](https://github.com/semantic-release/semantic-release) - Automated version management and package publishing
- [@semantic-release/github](https://github.com/semantic-release/github) - GitHub plugin for semantic-release
- [@semantic-release/gitlab](https://github.com/semantic-release/gitlab) - GitLab plugin for semantic-release
- [Forgejo](https://forgejo.org/) - Self-hosted Git service (fork of Gitea)
- [Gitea](https://gitea.io/) - Self-hosted Git service
