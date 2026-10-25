import { parseProfileDocument, type ProfileDocument, type ProfileId } from '../storage'
import { AuthError, ConflictError, NetworkError, RemoteError, type RemoteFile, type RemoteStore } from './types'

export interface GitHubConfig {
  owner: string
  repo: string
  /** Fine-grained token with Contents read/write on the data repo. Held in memory only here. */
  token: string
}

const API = 'https://api.github.com'

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Syncs one JSON file per profile (`nasim.json`, `kash.json`) through the GitHub contents API.
 *  The token goes only into the Authorization header; no message or log ever includes it. */
export class GitHubSync implements RemoteStore {
  constructor(
    private cfg: GitHubConfig,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  private headers(accept = 'application/vnd.github+json'): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, { cache: 'no-store', ...init })
    } catch {
      throw new NetworkError('Could not reach GitHub.')
    }
  }

  private path(profileId: ProfileId) {
    return `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${profileId}.json`
  }

  async fetch(profileId: ProfileId): Promise<RemoteFile> {
    const res = await this.request(this.path(profileId), { headers: this.headers() })
    if (res.status === 401) throw new AuthError('Token rejected.')
    if (res.status === 404) {
      // A missing file and a missing repo both look like 404. Ask about the repo to tell them apart.
      const repo = await this.request(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}`, { headers: this.headers() })
      if (repo.status === 401) throw new AuthError('Token rejected.')
      if (repo.ok) return { doc: null, version: null }
      throw new RemoteError(
        `Repo ${this.cfg.owner}/${this.cfg.repo} was not found, or the token has no access to it.`,
        repo.status,
      )
    }
    if (!res.ok) throw new RemoteError(`GitHub returned ${res.status}.`, res.status)

    const meta = (await res.json()) as { sha: string; content?: string; encoding?: string }
    let text: string
    if (meta.encoding === 'base64' && meta.content) {
      text = fromBase64(meta.content)
    } else {
      // Files over 1 MB come back without inline content. Ask for the raw body instead.
      const raw = await this.request(this.path(profileId), { headers: this.headers('application/vnd.github.raw+json') })
      if (!raw.ok) throw new RemoteError(`GitHub returned ${raw.status}.`, raw.status)
      text = await raw.text()
    }
    try {
      return { doc: parseProfileDocument(text), version: meta.sha }
    } catch (e) {
      throw new RemoteError(`The ${profileId}.json file in the repo is not readable: ${(e as Error).message}`)
    }
  }

  async put(profileId: ProfileId, doc: ProfileDocument, version: string | null): Promise<string> {
    const body: Record<string, string> = {
      message: `Sync ${profileId} ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(doc, null, 2)),
    }
    if (version) body.sha = version
    const res = await this.request(this.path(profileId), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 401) throw new AuthError('Token rejected.')
    if (res.status === 409 || res.status === 422) throw new ConflictError('The file changed on GitHub.')
    if (res.status === 403 || res.status === 404) {
      throw new RemoteError('GitHub refused the write. Check that the token has Contents read and write on the data repo.', res.status)
    }
    if (!res.ok) throw new RemoteError(`GitHub returned ${res.status}.`, res.status)
    const out = (await res.json()) as { content: { sha: string } }
    return out.content.sha
  }
}
