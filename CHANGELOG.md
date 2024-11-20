# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Next

- Removed npm package eslint.
- Deleted the .eslintrc.js configuration file for eslint.
- Remove lint command from package.json
- Delete and regenerate package-lock.json
- There were no code changes in this commit.

The intent behind removing eslint is to eliminate future GitHub notifications for outdated development dependencies. 

## [v1.0.0](https://github.com/cotarr/collab-iot-client-token/releases/tag/v1.0.0) - 2023-07-06

- Resolved eslint causing npm audit warning by manual install semver@7.5.3. This is a development dependency, there are no production dependencies in this module.

## v1.0.0-dev 2023-07-06 - Initial commit

- New repository
- Export `src/get-token.js` from the collab-iot-device repository as `src/index.js`.
- Install eslint with custom rules
- Add README.md, CHANGELOG.md, .gitignore, .npmignore. package.json, package-lock.json
