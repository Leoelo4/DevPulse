# Architecture decision records

Short records of the decisions that shape DevPulse, why they were made, and what they cost. They describe the state of the code when written; if a decision changes, add a new record that supersedes the old one rather than rewriting history.

| #                                              | Decision                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [0001](0001-stack-and-dependency-choices.md)   | Stack and dependency choices (and why some lag "latest")     |
| [0002](0002-data-source-and-resource-model.md) | One data-source seam and a `Resource` type for missing data  |
| [0003](0003-authentication-and-permissions.md) | Better Auth, no-scope sign-in, and server-side authorization |
| [0004](0004-caching-and-rate-limits.md)        | Layered caching and rate-limit behaviour                     |
| [0005](0005-cache-components-and-rendering.md) | Cache Components, request-time rendering and the proxy       |

Template: **Context** (the forces), **Decision**, **Consequences** (good and bad), and **Alternatives considered**.
