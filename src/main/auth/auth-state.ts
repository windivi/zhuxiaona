import { authStorage } from './auth-storage';

let cookieValue = '';
let csrfToken = '';

const authInfo = authStorage.getAuth();
cookieValue = authInfo.cookies || '';
csrfToken = authInfo.csrfToken || '';

export function getCookies() {
  return cookieValue;
}

export function getCsrfToken() {
  return csrfToken;
}

export function setCookies(val: string) {
  cookieValue = val || '';
  try { authStorage.setCookies(cookieValue); } catch (e) { }
}

export function setCsrfToken(val: string) {
  csrfToken = val || '';
  try { authStorage.setCsrfToken(csrfToken); } catch (e) { }
}

export function getAuthInfo() {
  return { cookies: cookieValue, csrfToken };
}
