import { useNavigate } from 'react-router-dom'

/** Redirect home when a repository was deleted or does not exist. */
export function handleRepoNotFound(err, navigate) {
  if (err?.response?.status === 404) {
    navigate('/')
    return true
  }
  return false
}
