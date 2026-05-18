const AUTH_KEY = "lc_auth";

export function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function markLoggedIn() {
  localStorage.setItem(AUTH_KEY, "1");
}
