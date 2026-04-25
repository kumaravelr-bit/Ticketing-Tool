import {
  Button,
  TextField,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  CircularProgress,
} from "@mui/material";

import api from "../../services/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../css/shared/Login.module.css";
import logo from "../../assets/image1.png";
import {
  clearLegacyAuthStorage,
  setAuthSession,
} from "../../utils/auth";

function EyeIcon({ off = false }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-0.61 1.37-1.54 2.63-2.72 3.71M6.1 6.1C3.91 7.43 2.18 9.47 1 12c1.73 3.89 6 7 11 7 1.55 0 3.03-.3 4.38-.84"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M1 12c1.73-3.89 6-7 11-7s9.27 3.11 11 7c-1.73 3.89-6 7-11 7S2.73 15.89 1 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Login() {
  const [empId, setEmpId]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockLogin, setCapsLockLogin] = useState(false);

  // 🔐 Forgot Password States
  const [open, setOpen]                       = useState(false);
  const [fpEmpId, setFpEmpId]                 = useState("");
  const [email, setEmail]                     = useState("");
  const [otp, setOtp]                         = useState("");
  const [step, setStep]                       = useState(1);
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpLoading, setOtpLoading]           = useState(false);
  const [timer, setTimer]                     = useState(0);
  const [showNewPw, setShowNewPw]             = useState(false);
  const [showConfirmPw, setShowConfirmPw]     = useState(false);
  const [capsLockNewPw, setCapsLockNewPw]     = useState(false);
  const [capsLockConfirmPw, setCapsLockConfirmPw] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    clearLegacyAuthStorage();
  }, []);

  // ⏱ TIMER
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // 🔄 RESET MODAL
  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setFpEmpId("");
    setEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setTimer(0);
  };

  // 🔐 PASSWORD STRENGTH
  const getPasswordStrength = (pw) => {
    if (!pw) return "";
    let strength = 0;
    if (pw.length >= 6)       strength++;
    if (/[A-Z]/.test(pw))     strength++;
    if (/[0-9]/.test(pw))     strength++;
    if (/[@$!%*?&]/.test(pw)) strength++;
    if (strength <= 1) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthColor    = passwordStrength === "Strong" ? "#22c55e"
                         : passwordStrength === "Medium" ? "#f59e0b"
                         : "#f43f5e";
  const strengthWidth    = passwordStrength === "Strong" ? "100%"
                         : passwordStrength === "Medium" ? "60%"
                         : newPassword ? "28%" : "0%";

  const isPasswordValid =
    newPassword.length >= 6 &&
    passwordStrength !== "Weak" &&
    newPassword === confirmPassword;

  // 🔐 LOGIN
  const login = async (e) => {
    e.preventDefault();
    if (loading || !empId || !password) return;
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { empId, password });
      const teamName = res.data.team || res.data.team_name || "";
      setAuthSession({
        token: res.data.token,
        role: res.data.role,
        team: teamName,
        emp_id: res.data.emp_id,
        designation: res.data.designation || res.data.designation_name || "",
        designation_name: res.data.designation_name || res.data.designation || "",
        loginTime: Date.now(),
        user: JSON.stringify({
          emp_id: res.data.emp_id,
          role:   res.data.role?.toString().trim().toUpperCase(),
          name: res.data.name || "",
          team: teamName || "",
          team_name: res.data.team_name || teamName || "",
          designation: res.data.designation || "",
          designation_name: res.data.designation_name || res.data.designation || "",
          profile_photo: res.data.profile_photo || null,
        }),
      });
      const normalizedRole = res.data.role?.toString().trim().toUpperCase();
      navigate(
        normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN"
          ? "/create"
          : "/active",
        { replace: true }
      );
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Helper: step dot class
  const dotClass = (n) =>
    n < step
      ? `${styles.stepDot} ${styles.stepDotDone}`
      : n === step
      ? `${styles.stepDot} ${styles.stepDotActive}`
      : styles.stepDot;

  const handleCapsLock = (setter) => (e) => {
    setter(e.getModifierState("CapsLock"));
  };

  return (
    /*
      ✅ KEY FIX: loginRoot applies overflow:hidden ONLY to this
      component's div — it does NOT leak to html/body/root,
      so all other pages (Layout, dashboards, etc.) scroll normally.
    */
    <div className={styles.loginRoot}>
      <div className={styles.container}>
        <div className={styles.wrapper}>

          {/* ============================
              LEFT — LOGIN FORM
          ============================= */}
          <div className={styles.leftSection}>
            <Box component="form" onSubmit={login} className={styles.card}>

              <div className={styles.header}>
                <Typography className={styles.title}>Welcome Back</Typography>
                <Typography className={styles.subtitle}>
                  Sign in to your INFONET account
                </Typography>
              </div>

              <TextField
                label="Employee ID"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className={styles.input}
                fullWidth
                variant="outlined"
                autoComplete="username"
              />

              <TextField
                type={showPassword ? "text" : "password"}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleCapsLock(setCapsLockLogin)}
                onKeyUp={handleCapsLock(setCapsLockLogin)}
                onBlur={() => setCapsLockLogin(false)}
                className={styles.input}
                fullWidth
                variant="outlined"
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        className={styles.passwordToggle}
                      >
                        <EyeIcon off={showPassword} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {capsLockLogin && (
                <Typography className={styles.capsWarning}>
                  Caps Lock is on
                </Typography>
              )}

              <Typography
                className={styles.forgotLink}
                onClick={() => setOpen(true)}
              >
                Forgot password?
              </Typography>

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                className={styles.button}
                fullWidth
              >
                {loading ? (
                  <>
                    <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <Typography className={styles.footerText}>
                Need help? Contact your administrator
              </Typography>
            </Box>
          </div>

          {/* ============================
              RIGHT — BRANDING / HALF-CIRCLE
          ============================= */}
          <div className={styles.rightSection}>
            {/* Decorative floating bubbles */}
            <div className={styles.bubble} style={{ width: 80,  height: 80,  top: "8%",    right: "12%" }} />
            <div className={styles.bubble} style={{ width: 44,  height: 44,  top: "22%",   right: "5%"  }} />
            <div className={styles.bubble} style={{ width: 28,  height: 28,  bottom: "18%",right: "18%" }} />
            <div className={styles.bubble} style={{ width: 60,  height: 60,  bottom: "10%",left: "16%"  }} />

            <div className={styles.rightContent}>
              <img src={logo} alt="INFONET Logo" className={styles.logo} />
              <Typography className={styles.brandText}>
                Welcome to <span>INFONET</span>
              </Typography>
              <Typography className={styles.tagline}>
                Empowering Innovation&nbsp;•&nbsp;Connecting Excellence
              </Typography>
            </div>
          </div>
        </div>
      </div>

      {/* ============================
          FORGOT PASSWORD MODAL
      ============================= */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: styles.fpPaper }}
      >
        <DialogTitle className={styles.fpTitle} disableTypography>
          <Typography className={styles.fpTitleText}>
            {step === 1 ? "Reset Password"
             : step === 2 ? "Verify OTP"
             : "Set New Password"}
          </Typography>
          <Typography className={styles.fpSubtitle}>
            {step === 1 ? "Enter your Employee ID and registered email"
             : step === 2 ? "Enter the OTP sent to your email"
             : "Choose a strong new password"}
          </Typography>
        </DialogTitle>

        <DialogContent className={styles.fpContent}>
          {/* Step indicator */}
          <div className={styles.stepDots}>
            <div className={dotClass(1)} />
            <div className={dotClass(2)} />
            <div className={dotClass(3)} />
          </div>

          {/* ── STEP 1: Emp ID + Email ── */}
          {step === 1 && (
            <>
              <TextField
                label="Employee ID"
                fullWidth
                value={fpEmpId}
                onChange={(e) => setFpEmpId(e.target.value)}
                className={styles.fpInput}
                sx={{ mb: 2 }}
                variant="outlined"
              />
              <TextField
                label="Email Address"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.fpInput}
                sx={{ mb: 3 }}
                variant="outlined"
              />
              <Button
                fullWidth
                variant="contained"
                disabled={otpLoading || !fpEmpId || !email}
                className={styles.fpButton}
                onClick={async () => {
                  try {
                    setOtpLoading(true);
                    await api.post("/auth/forgot-password", { empId: fpEmpId, email });
                    setStep(2);
                    setTimer(60);
                  } catch (err) {
                    alert(err.response?.data?.message || "Failed to send OTP");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                {otpLoading ? (
                  <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Sending…</>
                ) : "Send OTP"}
              </Button>
            </>
          )}

          {/* ── STEP 2: OTP Verify ── */}
          {step === 2 && (
            <>
              <TextField
                label="Enter OTP"
                fullWidth
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={styles.fpInput}
                inputProps={{ maxLength: 6, inputMode: "numeric" }}
                sx={{ mb: 2.5 }}
                variant="outlined"
              />
              <Button
                fullWidth
                variant="contained"
                disabled={otpLoading || !otp}
                className={styles.fpButton}
                sx={{ mb: 1 }}
                onClick={async () => {
                  try {
                    setOtpLoading(true);
                    await api.post("/auth/verify-otp", { empId: fpEmpId, email, otp });
                    setStep(3);
                  } catch (err) {
                    alert(err.response?.data?.message || "Invalid OTP");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                {otpLoading ? (
                  <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Verifying…</>
                ) : "Verify OTP"}
              </Button>

              <Button
                fullWidth
                variant="text"
                disabled={timer > 0 || otpLoading}
                className={styles.fpResend}
                onClick={async () => {
                  try {
                    setOtpLoading(true);
                    await api.post("/auth/forgot-password", { empId: fpEmpId, email });
                    setTimer(60);
                  } catch {
                    alert("Failed to resend OTP");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
              </Button>
            </>
          )}

          {/* ── STEP 3: New Password ── */}
          {step === 3 && (
            <>
              <TextField
                label="New Password"
                type={showNewPw ? "text" : "password"}
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={handleCapsLock(setCapsLockNewPw)}
                onKeyUp={handleCapsLock(setCapsLockNewPw)}
                onBlur={() => setCapsLockNewPw(false)}
                className={styles.fpInput}
                sx={{ mb: 1 }}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNewPw(!showNewPw)}
                        edge="end"
                        size="small"
                        className={styles.passwordToggle}
                      >
                        <EyeIcon off={showNewPw} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {capsLockNewPw && (
                <Typography className={styles.capsWarningModal}>
                  Caps Lock is on
                </Typography>
              )}

              {/* Strength bar */}
              <div
                className={styles.strengthBar}
                style={{
                  width: strengthWidth,
                  background: strengthColor,
                  maxWidth: "100%",
                }}
              />

              {newPassword && (
                <Typography sx={{
                  fontSize: "12px",
                  mb: 2,
                  color: strengthColor,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 500,
                }}>
                  Strength: {passwordStrength}
                </Typography>
              )}

              <TextField
                label="Confirm New Password"
                type={showConfirmPw ? "text" : "password"}
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleCapsLock(setCapsLockConfirmPw)}
                onKeyUp={handleCapsLock(setCapsLockConfirmPw)}
                onBlur={() => setCapsLockConfirmPw(false)}
                error={Boolean(confirmPassword && newPassword !== confirmPassword)}
                helperText={
                  confirmPassword && newPassword !== confirmPassword
                    ? "Passwords do not match" : ""
                }
                className={styles.fpInput}
                sx={{ mb: 3 }}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        edge="end"
                        size="small"
                        className={styles.passwordToggle}
                      >
                        <EyeIcon off={showConfirmPw} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {capsLockConfirmPw && (
                <Typography className={styles.capsWarningModal}>
                  Caps Lock is on
                </Typography>
              )}

              <Button
                fullWidth
                variant="contained"
                disabled={!isPasswordValid || otpLoading}
                className={styles.fpButton}
                onClick={async () => {
                  try {
                    setOtpLoading(true);
                    await api.post("/auth/reset-password", {
                      empId: fpEmpId,
                      email,
                      password: newPassword,
                    });
                    alert("Password reset successful!");
                    handleClose();
                  } catch {
                    alert("Password reset failed");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                {otpLoading ? (
                  <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Resetting…</>
                ) : "Reset Password"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
