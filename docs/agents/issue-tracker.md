# Issue Tracker

IronPath uses GitHub Issues in `TinSB/fitness-app` for issue and PRD tracking.

Use the GitHub CLI from the repository root so it infers the correct remote:

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close an issue: `gh issue close <number> --comment "..."`

When a skill says to publish work to the issue tracker, create a GitHub issue unless the user explicitly asks for a local draft instead.

Do not create new labels, milestones, projects, or automation unless the user explicitly asks for that change.
