import { Button, TextField, Box, Typography } from "@mui/material";
import api from "../services/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {

  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const login = async (e) => {

    e.preventDefault(); // prevent page refresh

    if (!empId || !password) {
      alert("Employee ID & Password required");
      return;
    }

    try {

      const res = await api.post("/auth/login", {
        empId,
        password
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("emp_id", res.data.emp_id);
      localStorage.setItem("loginTime", Date.now());

      navigate("/create");

    } catch (err) {

      alert(err.response?.data?.message || "Server not reachable");

    }

  };

  return (

    <Box
      component="form"
      onSubmit={login}
      display="flex"
      flexDirection="column"
      gap={2}
      width={300}
      margin="100px auto"
    >

      <Typography variant="h6" textAlign="center">
        Employee Login
      </Typography>

      <TextField
        label="Employee ID"
        value={empId}
        onChange={(e) => setEmpId(e.target.value)}
      />

      <TextField
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button
        type="submit"
        variant="contained"
      >
        Login
      </Button>

    </Box>

  );

}