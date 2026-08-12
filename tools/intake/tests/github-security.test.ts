import { describe, expect, it } from "vitest";

import {
  GitHubClient,
  normalizeGitHubRepositoryUrl,
  type FetchLike,
} from "../src/github.js";
import { createGitHubMock, pinnedCommit } from "./helpers/github-mock.js";

const repositoryUrl = "https://github.com/fixture-owner/fixture-repository";
const artifactPath = "workflows/valid-dify.yml";
const publicRepository = {
  id: 123456,
  full_name: "fixture-owner/fixture-repository",
  default_branch: "main",
  private: false,
  visibility: "public",
};

function identity() {
  return normalizeGitHubRepositoryUrl(repositoryUrl);
}

describe("bounded GitHub redirect and authorization policy", () => {
  it("follows approved HTTPS GitHub redirects with manual hop validation", async () => {
    const requested: string[] = [];
    const fetch: FetchLike = async (input, init) => {
      requested.push(String(input));
      expect(init?.redirect).toBe("manual");
      if (requested.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://api.github.com/approved-repository-metadata" },
        });
      }
      return Response.json(publicRepository);
    };
    const repository = await new GitHubClient({ fetch }).inspectRepository(identity());
    expect(repository.identity.normalizedUrl).toBe(repositoryUrl);
    expect(requested).toHaveLength(2);
  });

  it("rejects redirects to an unapproved host or an embedded credential destination", async () => {
    for (const location of [
      "https://unapproved.example/repository",
      "https://user:password@api.github.com/repository",
    ]) {
      const fetch: FetchLike = async () => new Response(null, {
        status: 302,
        headers: { location },
      });
      await expect(new GitHubClient({ fetch }).inspectRepository(identity()))
        .rejects.toMatchObject({ code: "github.unsafe_redirect" });
    }
  });

  it("rejects redirects to HTTP", async () => {
    const fetch: FetchLike = async () => new Response(null, {
      status: 307,
      headers: { location: "http://api.github.com/repository" },
    });
    await expect(new GitHubClient({ fetch }).inspectRepository(identity()))
      .rejects.toMatchObject({ code: "github.unsafe_redirect" });
  });

  it("rejects redirect loops after the strict maximum hop count", async () => {
    let requestCount = 0;
    const fetch: FetchLike = async () => {
      requestCount += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://api.github.com/redirect-loop" },
      });
    };
    await expect(new GitHubClient({ fetch }).inspectRepository(identity()))
      .rejects.toMatchObject({ code: "github.too_many_redirects" });
    expect(requestCount).toBe(6);
  });

  it("does not forward Authorization when an approved redirect changes host", async () => {
    const fakeToken = "ghp_FAKEONLYFORREDIRECTTESTS123456789";
    const authorization: Array<string | null> = [];
    const fetch: FetchLike = async (_input, init) => {
      authorization.push(new Headers(init?.headers).get("Authorization"));
      if (authorization.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://raw.githubusercontent.com/fixture-owner/repository-metadata" },
        });
      }
      return Response.json(publicRepository);
    };
    await new GitHubClient({ fetch, token: fakeToken }).inspectRepository(identity());
    expect(authorization).toEqual([`Bearer ${fakeToken}`, null]);
  });
});

describe("public GitHub repository enforcement", () => {
  it("accepts a repository confirmed as public", async () => {
    const client = new GitHubClient({ fetch: await createGitHubMock() });
    await expect(client.inspectRepository(identity())).resolves.toMatchObject({
      defaultBranch: "main",
      identity: { normalizedUrl: repositoryUrl },
    });
  });

  it("rejects a private repository", async () => {
    const client = new GitHubClient({
      fetch: await createGitHubMock({ repositoryPrivate: true, repositoryVisibility: "private" }),
    });
    await expect(client.inspectRepository(identity())).rejects.toMatchObject({ code: "repository.private" });
  });

  it("rejects internal or otherwise non-public visibility", async () => {
    for (const visibility of ["internal", "private"]) {
      const client = new GitHubClient({
        fetch: await createGitHubMock({ repositoryPrivate: false, repositoryVisibility: visibility }),
      });
      await expect(client.inspectRepository(identity()))
        .rejects.toMatchObject({ code: "repository.not_public" });
    }
  });

  it("does not let a privileged token bypass the public-only policy", async () => {
    const fakeToken = "ghp_FAKEONLYFORPUBLICPOLICY123456789";
    const client = new GitHubClient({
      fetch: await createGitHubMock({ repositoryPrivate: true, repositoryVisibility: "private" }),
      token: fakeToken,
    });
    let error: unknown;
    try {
      await client.inspectRepository(identity());
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "repository.private" });
    expect(JSON.stringify(error)).not.toContain(fakeToken);
  });
});

describe("GitHub request and artifact-size boundaries", () => {
  it("aborts a GitHub request at the configured timeout boundary", async () => {
    const fetch: FetchLike = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing abort signal"));
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const client = new GitHubClient({ fetch, requestTimeoutMilliseconds: 5 });
    await expect(client.inspectRepository(identity()))
      .rejects.toMatchObject({ code: "github.network_error" });
  });

  it("accepts an artifact exactly at the byte limit", async () => {
    const bytes = Buffer.from("1234", "utf8");
    const client = new GitHubClient({
      fetch: await createGitHubMock({ artifactBytes: bytes }),
      maximumArtifactBytes: bytes.byteLength,
    });
    const repository = await client.inspectRepository(identity());
    const retrieved = await client.retrieveArtifact(repository, pinnedCommit, artifactPath);
    expect(Buffer.from(retrieved.bytes)).toEqual(bytes);
  });

  it("rejects an artifact one byte above the byte limit", async () => {
    const bytes = Buffer.from("12345", "utf8");
    const client = new GitHubClient({
      fetch: await createGitHubMock({ artifactBytes: bytes }),
      maximumArtifactBytes: bytes.byteLength - 1,
    });
    const repository = await client.inspectRepository(identity());
    await expect(client.retrieveArtifact(repository, pinnedCommit, artifactPath))
      .rejects.toMatchObject({ code: "artifact.too_large" });
  });

  it("rejects a reported-size mismatch", async () => {
    const bytes = Buffer.from("1234", "utf8");
    const client = new GitHubClient({
      fetch: await createGitHubMock({ artifactBytes: bytes, reportedSize: bytes.byteLength - 1 }),
      maximumArtifactBytes: 10,
    });
    const repository = await client.inspectRepository(identity());
    await expect(client.retrieveArtifact(repository, pinnedCommit, artifactPath))
      .rejects.toMatchObject({ code: "artifact.size_mismatch" });
  });

  it("stops an oversized raw response while reading the body", async () => {
    const maximumBytes = 4;
    const client = new GitHubClient({
      fetch: await createGitHubMock({
        artifactBytes: Buffer.from("1234", "utf8"),
        reportedSize: null,
        useRawResponse: true,
        rawResponseBytes: Buffer.from("12345", "utf8"),
      }),
      maximumArtifactBytes: maximumBytes,
    });
    const repository = await client.inspectRepository(identity());
    await expect(client.retrieveArtifact(repository, pinnedCommit, artifactPath))
      .rejects.toMatchObject({ code: "artifact.too_large" });
  });
});
