import {
  Button,
  TextField,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  Dialog,
  DialogContent
} from "@mui/material";

import { Visibility, VisibilityOff } from "@mui/icons-material";
import api from "../services/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../css/Login.module.css";

export default function Login() {

  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 🔐 Forgot Password States
  const [open, setOpen] = useState(false);
  const [fpEmpId, setFpEmpId] = useState(""); // ✅ separate state
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const navigate = useNavigate();

  // ⏱ TIMER
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
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
  const getPasswordStrength = (password) => {
    if (!password) return "";

    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    if (strength <= 1) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const isPasswordValid =
    newPassword.length >= 6 &&
    passwordStrength !== "Weak" &&
    newPassword === confirmPassword;

  // 🔐 LOGIN
  const login = async (e) => {
    e.preventDefault();

    if (loading) return;
    if (!empId || !password) return;

    setLoading(true);

    try {
      const res = await api.post("/auth/login", { empId, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("emp_id", res.data.emp_id);
      localStorage.setItem("loginTime", Date.now());

      localStorage.setItem(
        "user",
        JSON.stringify({
          emp_id: res.data.emp_id,
          role: res.data.role?.toString().trim().toUpperCase()
        })
      );

      navigate("/create", { replace: true });

    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Box component="form" onSubmit={login} className={styles.card}>

        <Typography className={styles.title}>
          Employee Login
        </Typography>

        <TextField
          label="Employee ID"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          className={styles.input}
          fullWidth
        />

        <TextField
          type={showPassword ? "text" : "password"}
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          className={styles.button}
          fullWidth
        >
          {loading ? "Logging..." : "Login"}
        </Button>

        <Typography
          sx={{ textAlign: "right", cursor: "pointer", color: "#b8962e" }}
          onClick={() => setOpen(true)}
        >
          Forgot Password?
        </Typography>

      </Box>

      {/* 🔐 MODAL */}
      <Dialog open={open} onClose={handleClose}>
        <DialogContent>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <TextField
                label="Employee ID"
                fullWidth
                value={fpEmpId}
                onChange={(e) => setFpEmpId(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Button
                fullWidth
                disabled={otpLoading}
                onClick={async () => {
                  try {
                    setOtpLoading(true);

                    await api.post("/auth/forgot-password", {
                      empId: fpEmpId,
                      email
                    });

                    setStep(2);
                    setTimer(60);

                  } catch (err) {
                    alert(err.response?.data?.message);
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                Send OTP
              </Button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <TextField
                label="Enter OTP"
                fullWidth
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />

              <Button
                fullWidth
                disabled={otpLoading}
                onClick={async () => {
                  try {
                    setOtpLoading(true);

                    await api.post("/auth/verify-otp", {
                      empId: fpEmpId,
                      email,
                      otp
                    });

                    setStep(3);

                  } catch (err) {
                    alert(err.response?.data?.message);
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                Verify OTP
              </Button>

              <Button
                fullWidth
                disabled={timer > 0 || otpLoading}
                onClick={async () => {
                  try {
                    setOtpLoading(true);

                    await api.post("/auth/forgot-password", {
                      empId: fpEmpId,
                      email
                    });

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

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <TextField
                label="New Password"
                type="password"
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Typography
                sx={{
                  fontSize: 12,
                  color:
                    passwordStrength === "Strong"
                      ? "green"
                      : passwordStrength === "Medium"
                      ? "orange"
                      : "red"
                }}
              >
                Strength: {passwordStrength}
              </Typography>

              <TextField
                label="Confirm Password"
                type="password"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword && newPassword !== confirmPassword}
                helperText={
                  confirmPassword && newPassword !== confirmPassword
                    ? "Passwords do not match"
                    : ""
                }
              />

              <Button
                fullWidth
                disabled={!isPasswordValid || otpLoading}
                onClick={async () => {
                  try {
                    setOtpLoading(true);

                    await api.post("/auth/reset-password", {
                      empId: fpEmpId,
                      email,
                      password: newPassword
                    });

                    alert("Password Reset Success");
                    handleClose();

                  } catch {
                    alert("Reset failed");
                  } finally {
                    setOtpLoading(false);
                  }
                }}
              >
                Reset Password
              </Button>
            </>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}