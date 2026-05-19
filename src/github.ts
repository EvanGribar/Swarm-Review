import type { Octokit } from "@octokit/rest";

const MANAGED_COMMENT_MARKER = "<!-- swarm-review:managed-comment -->";

export type UpsertPullRequestCommentResult = {
  action: "created" | "updated";
  commentId: number;
  commentUrl?: string;
};

export function parsePositiveInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function withManagedCommentMarker(body: string): string {
  if (body.includes(MANAGED_COMMENT_MARKER)) {
    return body;
  }

  return `${body}\n\n${MANAGED_COMMENT_MARKER}`;
}

export async function upsertPullRequestComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<UpsertPullRequestCommentResult> {
  const managedBody = withManagedCommentMarker(body);

  const [comments, authenticatedUser] = await Promise.all([
    octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    }),
    octokit.rest.users.getAuthenticated()
      .then((res) => res.data)
      .catch(() => null),
  ]);

  const existingComment = [...comments].reverse().find(
    (comment) =>
      comment.body?.includes(MANAGED_COMMENT_MARKER) ||
      (comment.body?.startsWith("## swarm-review") &&
        (comment.user?.type === "Bot" || (authenticatedUser && comment.user?.login === authenticatedUser.login)))
  );

  if (existingComment) {
    const response = await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: managedBody,
    });

    return {
      action: "updated",
      commentId: response.data.id,
      commentUrl: response.data.html_url,
    };
  }

  const response = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: managedBody,
  });

  return {
    action: "created",
    commentId: response.data.id,
    commentUrl: response.data.html_url,
  };
}

export async function updateCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: string | undefined,
  summary: string
): Promise<boolean> {
  if (!checkRunId) {
    return false;
  }

  const numericCheckRunId = parsePositiveInteger(checkRunId);
  if (numericCheckRunId === undefined) {
    return false;
  }

  await octokit.rest.checks.update({
    owner,
    repo,
    check_run_id: numericCheckRunId,
    status: "completed",
    conclusion: "neutral",
    output: {
      title: "swarm-review",
      summary: summary.length > 65535 ? summary.slice(0, 65530) + "..." : summary,
    },
  });

  return true;
}

export async function createPullRequestReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
  body: string,
  comments: Array<{ path: string; line: number; body: string }>
): Promise<void> {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event,
    body: body.length > 65535 ? body.slice(0, 65530) + "..." : body,
    comments: comments.map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
      side: "RIGHT",
    })),
  });
}
