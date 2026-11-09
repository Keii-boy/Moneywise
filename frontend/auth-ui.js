// MoneyWise optional authentication UI enhancement.
// Add <script src="auth-ui.js"></script> AFTER script.js in index.html.
(() => {
  const login = document.getElementById("loginForm");
  const register = document.getElementById("registerForm");
  const auth = document.getElementById("authSection");
  if (!login || !register || !auth) return;

  const note = document.createElement("div");
  note.className = "auth-addon-note";
  note.setAttribute("role", "status");
  register.after(note);

  function makeButton(label, fn) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = "auth-addon-button";
    btn.addEventListener("click", fn);
    return btn;
  }
  function makeInput(placeholder, type = "text") {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.className = "auth-addon-input";
    return input;
  }
  const formContainer = document.createElement("div");
  formContainer.className = "auth-addon-actions";
  login.after(formContainer);

  async function request(endpoint, data) {
    const res = await fetch(endpoint, {method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.message || "Request failed.");
    return payload;
  }
  const emailInput = makeInput("Email address", "email");
  emailInput.autocomplete = "email";
  const emailActions = document.createElement("div");
  emailActions.className = "auth-addon-stack";
  emailActions.append(emailInput);
  const forgot = makeButton("Send password reset email", async () => {
    try {note.textContent = (await request("/api/auth/forgot-password", {email:emailInput.value.trim()})).message;}
    catch(e) {note.textContent = e.message;}
  });
  const resend = makeButton("Resend verification email", async () => {
    try {note.textContent = (await request("/api/auth/resend-verification", {email:emailInput.value.trim()})).message;}
    catch(e) {note.textContent = e.message;}
  });
  emailActions.append(forgot, resend);
  formContainer.append(emailActions);
  const googleArea = document.createElement("div");
  googleArea.className = "auth-google-container";
  formContainer.prepend(googleArea);

  function showTokenDialog(purpose, token) {
    const card = document.createElement("div");
    card.className = "auth-token-dialog";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label",purpose === "verify" ? "Verify email" : "Reset password");
    const heading = document.createElement("h2");
    heading.textContent = purpose === "verify" ? "Verify your email" : "Reset your password";
    const message = document.createElement("p");
    message.setAttribute("role","status");
    const password = purpose === "reset" ? makeInput("New password (12+ characters)","password") : null;
    if (password) {password.minLength = 12;password.autocomplete="new-password";}
    const proceed = makeButton(purpose === "verify" ? "Verify Email" : "Set New Password", async () => {
      proceed.disabled = true;
      try {
        const endpoint = purpose === "verify" ? "/api/auth/verify-email" : "/api/auth/reset-password";
        const payload = {token};
        if (password) payload.password = password.value;
        message.textContent = (await request(endpoint,payload)).message;
        history.replaceState({}, "", location.pathname);
      } catch(e) {message.textContent = e.message;}
      finally {proceed.disabled = false;}
    });
    card.append(heading);
    if (password) card.append(password);
    card.append(proceed,message);
    document.body.append(card);
  }

  const params = new URLSearchParams(location.search);
  const verifyToken = params.get("verify_token");
  const resetToken = params.get("reset_token");
  if (verifyToken) showTokenDialog("verify",verifyToken);
  if (resetToken) showTokenDialog("reset",resetToken);

  // Google Identity Services: credential button; backend verifies Google ID token.
  fetch("/api/auth/config").then(res=>res.json()).then(config=>{
    if (!config.googleClientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) return;
      google.accounts.id.initialize({client_id: config.googleClientId, callback: async (result) => {
        try {await request("/api/auth/google", {credential:result.credential});location.assign("/");}
        catch(e) {note.textContent = e.message;}
      }});
      google.accounts.id.renderButton(googleArea, {theme:"outline",size:"large",text:"continue_with",width:270});
    };
    document.head.append(script);
  }).catch(error=>console.error("Google button config:",error));

  // Existing settings form from previous lesson.
  const passwordForm = document.getElementById("changePasswordForm");
  passwordForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const message = document.getElementById("passwordMessage");
    try {
      const data = await request("/api/account/password", {
        currentPassword:document.getElementById("currentPassword").value,
        newPassword:document.getElementById("newPassword").value
      });
      message.textContent = data.message;
      passwordForm.reset();
    } catch(error) {message.textContent = error.message;}
  });
})();
