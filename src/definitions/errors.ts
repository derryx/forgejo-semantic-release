export interface ErrorDefinition {
  message: string;
  details: string;
}

export const ERROR_DEFINITIONS: Record<string, ErrorDefinition> = {
  ENOFORGEJOTOKEN: {
    message: 'No Forgejo token specified.',
    details: `A Forgejo personal access token must be provided via the \`FORGEJO_TOKEN\` or \`GITEA_TOKEN\` environment variable, or the \`forgejoToken\` plugin configuration option.

Please create a token with the \`write:repository\` scope at:
{forgejoUrl}/user/settings/applications`,
  },

  ENOFORGEJOURL: {
    message: 'Unable to determine Forgejo server URL.',
    details: `The Forgejo server URL must be provided via the \`FORGEJO_URL\` or \`GITEA_URL\` environment variable, the \`forgejoUrl\` plugin configuration option, or derived from the git remote origin.

Ensure your git remote is properly configured or explicitly set the URL.`,
  },

  EINVALIDFORGEJOTOKEN: {
    message: 'Invalid Forgejo token.',
    details: `The token provided could not be authenticated with the Forgejo API.

Ensure the token is valid and has not expired.
API Response: {statusCode} {statusMessage}`,
  },

  ENOPUSHPERMISSION: {
    message: 'Insufficient repository permissions.',
    details: `The authenticated user does not have push access to {owner}/{repo}.

Creating releases requires write access to the repository.`,
  },

  ENOREPO: {
    message: 'Repository not found.',
    details: `The repository {owner}/{repo} does not exist or is not accessible.

Verify the repository exists and the token has access to it.`,
  },

  EINVALIDASSETS: {
    message: 'Invalid asset configuration.',
    details: `The asset configuration is invalid: {reason}

Assets must be a string, array of strings, or array of asset objects with a 'path' property.`,
  },

  ENOASSETFOUND: {
    message: 'No files found for asset pattern.',
    details: `No files matched the pattern: {pattern}

Verify the glob pattern matches existing files.`,
  },

  ERELEASECREATION: {
    message: 'Failed to create Forgejo release.',
    details: `The API request to create the release failed.

Tag: {tag}
Error: {error}`,
  },

  EASSETUPLOAD: {
    message: 'Failed to upload release asset.',
    details: `The asset upload failed for: {filename}

Error: {error}`,
  },

  EINVALIDGITURL: {
    message: 'Invalid git remote URL.',
    details: `Could not parse the git remote URL: {url}

The URL should be in the format:
- https://forgejo.example.com/owner/repo.git
- git@forgejo.example.com:owner/repo.git`,
  },
} as const;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;
