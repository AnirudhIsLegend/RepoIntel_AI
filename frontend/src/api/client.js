import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const client = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

// ── JWT Request Interceptor ───────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// ── JWT Response Interceptor (auto-refresh on 401) ────────────────────────────
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })

  failedQueue = []
}

client.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config

    // Don't retry auth endpoints or already-retried requests
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/')
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return client(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refresh = localStorage.getItem('refresh_token')

    if (!refresh) {
      isRefreshing = false
      clearAndRedirect()
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post(
        `${API_URL}/api/auth/refresh`,
        { refresh },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      )

      localStorage.setItem('access_token', data.access)

      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh)
      }

      processQueue(null, data.access)

      originalRequest.headers.Authorization = `Bearer ${data.access}`

      return client(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearAndRedirect()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

function clearAndRedirect() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')

  if (
    !window.location.pathname.startsWith('/login') &&
    !window.location.pathname.startsWith('/auth')
  ) {
    window.location.href = '/login'
  }
}

// ── Repository endpoints ──────────────────────────────────────────────────────

export const analyzeRepository = (githubUrl) =>
  client.post('/repositories/analyze', {
    github_url: githubUrl,
  })

export const getRepository = (id) =>
  client.get(`/repositories/${id}/`)

export const listRepositories = () =>
  client.get('/repositories/')

export const getArchitecture = (id) =>
  client.get(`/repositories/${id}/architecture/`)

// ── Chat endpoints ────────────────────────────────────────────────────────────

export const chatWithRepo = (
  repositoryId,
  question,
  sessionId = null
) =>
  client.post('/chat/', {
    repository_id: repositoryId,
    question,
    session_id: sessionId,
  })

export const getChatHistory = (repoId) =>
  client.get(`/chat/history/${repoId}/`)

// ── SSE — real-time indexing progress ─────────────────────────────────────────

/**
 * Open a Server-Sent Events connection for a repository's indexing progress.
 *
 * SSE (EventSource) does not support custom headers in browsers, so the JWT
 * access token is passed as a query param which the Django view validates.
 *
 * @param {string|number} repoId - Repository ID
 * @param {function} onMessage - Called with parsed JSON data on each event
 * @param {function} onError - Called if the connection errors/closes
 * @returns {EventSource} The EventSource instance
 */
export const streamRepositoryStatus = (
  repoId,
  onMessage,
  onError
) => {
  const token = localStorage.getItem('access_token') || ''

  const url =
    `${API_URL}/api/repositories/${repoId}/stream/` +
    `?token=${encodeURIComponent(token)}`

  const es = new EventSource(url)

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      // Ignore malformed events
    }
  }

  es.onerror = () => {
    es.close()

    if (onError) {
      onError()
    }
  }

  return es
}

export default client