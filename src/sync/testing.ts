// Test helper: an in-memory stand-in for the GitHub contents API. Not used by the app.

interface Stored { text: string; sha: string }

export class FakeGitHub {
  files = new Map<string, Stored>()
  calls: { method: string; url: string; headers: Record<string, string>; body: string }[] = []
  offline = false
  repoExists = true
  /** Files longer than this come back without inline content, like GitHub does over 1 MB. */
  inlineLimit = Infinity
  /** Runs just before each PUT is applied; use it to simulate another device writing first. */
  beforePut: ((path: string) => void) | null = null
  private n = 0

  constructor(public token = 'good-token', public owner = 'n6sim', public repo = 'workout-data') {}

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    if (this.offline) throw new TypeError('Failed to fetch')
    const url = String(input)
    const method = init.method ?? 'GET'
    const headers = (init.headers ?? {}) as Record<string, string>
    this.calls.push({ method, url, headers, body: String(init.body ?? '') })
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

    if (headers.Authorization !== `Bearer ${this.token}`) return json(401, { message: 'Bad credentials' })

    const prefix = `https://api.github.com/repos/${this.owner}/${this.repo}`
    if (url === prefix) return this.repoExists ? json(200, { name: this.repo }) : json(404, { message: 'Not Found' })
    if (!url.startsWith(`${prefix}/contents/`)) return json(404, { message: 'Not Found' })
    if (!this.repoExists) return json(404, { message: 'Not Found' })
    const path = url.slice(`${prefix}/contents/`.length)

    if (method === 'GET') {
      const f = this.files.get(path)
      if (!f) return json(404, { message: 'Not Found' })
      if ((headers.Accept ?? '').includes('raw')) return new Response(f.text, { status: 200 })
      if (f.text.length > this.inlineLimit) return json(200, { sha: f.sha, content: '', encoding: 'none' })
      return json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') })
    }

    if (method === 'PUT') {
      this.beforePut?.(path)
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
      const f = this.files.get(path)
      if (f && !body.sha) return json(422, { message: '"sha" wasn\'t supplied.' })
      if (f && body.sha !== f.sha) return json(409, { message: 'does not match' })
      if (!f && body.sha) return json(422, { message: 'sha given for a new file' })
      const sha = `sha${++this.n}`
      this.files.set(path, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha })
      return json(200, { content: { sha } })
    }
    return json(405, {})
  }

  /** Simulates another device writing a file directly. */
  write(path: string, text: string) {
    this.files.set(path, { text, sha: `sha${++this.n}` })
  }
  read(path: string): unknown {
    const f = this.files.get(path)
    return f ? JSON.parse(f.text) : null
  }
}
