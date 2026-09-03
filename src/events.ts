const REREVIEW_COMMAND = /^\/swarm-review(?:\s+(debate))?$/i;
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export type RereviewCommand = "review" | "debate";

export function parseRereviewCommand(body: string): RereviewCommand | undefined {
  for (const line of body.split(/\r?\n/)) {
    const match = line.trim().match(REREVIEW_COMMAND);
    if (match) {
      return match[1] ? "debate" : "review";
    }
  }

  return undefined;
}

export function stripRereviewCommands(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !REREVIEW_COMMAND.test(line.trim()))
    .join("\n")
    .trim();
}

export function isTrustedRereviewActor(
  authorAssociation: unknown,
  userType: unknown
): boolean {
  const isBot = typeof userType === "string" && userType.toLowerCase() === "bot";
  return (
    !isBot &&
    typeof authorAssociation === "string" &&
    TRUSTED_ASSOCIATIONS.has(authorAssociation.toUpperCase())
  );
}

type PullRequestRepos = {
  pull_request?: {
    head?: { repo?: { full_name?: unknown } };
    base?: { repo?: { full_name?: unknown } };
  };
};

// True when the event is a pull request from a fork. Static analysis shell
// commands must not run on fork checkouts without an explicit opt-in.
export function isForkPullRequestEvent(payload: unknown): boolean {
  const repos = (payload as PullRequestRepos | null | undefined)?.pull_request;
  const head = repos?.head?.repo?.full_name;
  const base = repos?.base?.repo?.full_name;
  return typeof head === "string" && typeof base === "string" && head !== base;
}
