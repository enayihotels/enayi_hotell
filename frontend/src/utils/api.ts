// import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// export const api = axios.create({
//   baseURL: `${BASE_URL}/api/v1`,
//   headers: { 'Content-Type': 'application/json' },
//   timeout: 30_000,
// })

// api.interceptors.request.use(
//   (config: InternalAxiosRequestConfig) => {
//     const token = localStorage.getItem('access_token')
//     if (token && config.headers) config.headers.Authorization = `Bearer ${token}`
//     return config
//   },
//   (error) => Promise.reject(error)
// )

// api.interceptors.response.use(
//   (response) => response,
//   async (error: AxiosError) => {
//     const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
//     if (error.response?.status === 401 && !original._retry) {
//       original._retry = true
//       const refresh = localStorage.getItem('refresh_token')
//       if (refresh) {
//         try {
//           const { data } = await axios.post(`${BASE_URL}/api/v1/auth/token/refresh/`, { refresh })
//           localStorage.setItem('access_token', data.access)
//           api.defaults.headers.common.Authorization = `Bearer ${data.access}`
//           return api(original)
//         } catch {
//           localStorage.removeItem('access_token')
//           localStorage.removeItem('refresh_token')
//           window.location.href = '/login'
//         }
//       } else {
//         window.location.href = '/login'
//       }
//     }
//     return Promise.reject(error)
//   }
// )

// export const setAuthTokens = (access: string, refresh: string) => {
//   localStorage.setItem('access_token', access)
//   localStorage.setItem('refresh_token', refresh)
//   api.defaults.headers.common.Authorization = `Bearer ${access}`
// }

// export const clearAuthTokens = () => {
//   localStorage.removeItem('access_token')
//   localStorage.removeItem('refresh_token')
//   delete api.defaults.headers.common.Authorization
// }

// export const getErrorMessage = (error: unknown): string => {
//   if (axios.isAxiosError(error)) {
//     const data = error.response?.data
//     if (typeof data === 'string') return data
//     if (data?.error) return data.error
//     if (data?.detail) return data.detail
//     if (data?.message) return data.message
//     const firstKey = Object.keys(data || {})[0]
//     if (firstKey && Array.isArray(data[firstKey])) return `${firstKey}: ${data[firstKey][0]}`
//     return error.message
//   }
//   if (error instanceof Error) return error.message
//   return 'An unexpected error occurred'
// }


// // Unwraps paginated Django responses OR plain arrays
// export const unwrap = <T>(data: T[] | { results: T[] } | any): T[] => {
//   if (Array.isArray(data)) return data
//   if (data?.results && Array.isArray(data.results)) return data.results
//   return []
// }


// // Always returns a plain array from Django REST responses
// // Handles both: plain arrays [] and paginated {count, results:[]}

// export default api

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// In dev: leave VITE_API_URL empty and the Vite proxy forwards /api to :8000.
// In production (Render static site): set VITE_API_URL to your backend URL,
// e.g. https://enayi-backend.onrender.com  — requests then go there directly.
const BASE_URL = import.meta.env.VITE_API_URL || ''
export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${BASE_URL}/api/v1/auth/token/refresh/`,
            { refresh }
          )
          localStorage.setItem('access_token', data.access)
          api.defaults.headers.common.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const setAuthTokens = (access: string, refresh: string) => {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
  api.defaults.headers.common.Authorization = `Bearer ${access}`
}

export const clearAuthTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  delete api.defaults.headers.common.Authorization
}

export const unwrap = <T>(data: any): T[] => {
  if (Array.isArray(data)) return data
  if (data?.results && Array.isArray(data.results)) return data.results
  return []
}

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string') return data
    if (data?.error)   return data.error
    if (data?.detail)  return data.detail
    if (data?.message) return data.message
    const firstKey = Object.keys(data || {})[0]
    if (firstKey && Array.isArray(data[firstKey])) {
      return `${firstKey}: ${data[firstKey][0]}`
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

export default api
